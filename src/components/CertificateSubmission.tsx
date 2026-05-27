/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileImage, 
  Loader2, 
  CheckCircle2, 
  RefreshCw, 
  User, 
  CalendarDays,
  FileText 
} from "lucide-react";
import { compressImage } from "../utils";

interface ExtractedRules {
  studentName: string;
  birthDate: string;
}

function parseFilenameRules(fileName: string): ExtractedRules {
  const cleanName = fileName.replace(/\.[^/.]+$/, "");
  const parts = cleanName.split(/[-_\s]+/);
  
  let studentName = "";
  let birthDate = "";

  // 1. BirthDate matching: 6 digits (e.g. 850505) from filename
  const digit6Match = cleanName.match(/\b(\d{6})\b/);
  if (digit6Match) {
    birthDate = digit6Match[1];
  } else {
    const all6Digits = cleanName.match(/(\d{6})/g);
    if (all6Digits) {
      for (const d of all6Digits) {
        if (!d.startsWith("202") && !d.startsWith("201")) { // Avoid mismatch with year prefixes
          birthDate = d;
          break;
        }
      }
    }
  }

  // 2. Trainee Name: 2-4 character Hangul words. Skip common certificate nouns as user names.
  const nameKeywordsToSkip = [
    "수료증", "수료", "이수증", "이수", "교육", "과정", "센터", "협회", "대학", "학교", 
    "병원", "시간", "수정", "최종", "사본", "제출", "등록", "확인", "훈련", "일반", "전문", 
    "기본", "종합", "복지", "재활", "수원", "기관", "이름", "성명", "과제", "실습", "워크숍", "증명서"
  ];
  for (const part of parts) {
    if (/^[가-힣]{2,4}$/.test(part) && !nameKeywordsToSkip.some(kw => part.includes(kw))) {
      studentName = part;
      break;
    }
  }

  return {
    studentName,
    birthDate
  };
}

export interface CertificateSubmissionProps {
  onSuccess: () => void;
}

export default function CertificateSubmission({ onSuccess }: CertificateSubmissionProps) {
  // Upload and Image State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressedBase64, setCompressedBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [isPdf, setIsPdf] = useState<boolean>(false);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);

  // Form Field States
  const [studentName, setStudentName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop events
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        processFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  // Compress & Load File - NO AUTO GEMINI API CALL!
  const processFile = async (file: File) => {
    setSelectedFile(file);
    const mime = file.type || "image/jpeg";
    setImageMimeType(mime);
    setIsPdf(mime === "application/pdf");

    // Initial draft preview representation
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);

    // Apply basic filename rules immediately (client-side, robust and fast)
    try {
      const ruleData = parseFilenameRules(file.name);
      if (ruleData.studentName) {
        setStudentName(ruleData.studentName);
      }
      if (ruleData.birthDate) {
        setBirthDate(ruleData.birthDate);
      }
    } catch (ruleErr) {
      console.warn("Filename rules parsing error:", ruleErr);
    }

    // Process conversion to Base64 (compress if image)
    setIsProcessing(true);
    try {
      let base64 = "";
      if (mime === "application/pdf") {
        const reader = new FileReader();
        const readPromise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("PDF 파일 해독에 실패했습니다."));
            }
          };
          reader.onerror = () => reject(reader.error);
        });
        reader.readAsDataURL(file);
        base64 = await readPromise;
        setCompressedBase64(base64);
      } else {
        const compressed = await compressImage(file, 1200, 1200, 0.75);
        base64 = compressed.base64;
        setCompressedBase64(base64);
      }
    } catch (err) {
      console.error("Local file processing failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Form Submission
  const handleSubmitCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      alert("수강자 성명은 필수 기입 항목입니다.");
      return;
    }
    if (!birthDate.trim()) {
      alert("생년월일은 필수 기입 항목입니다.");
      return;
    }

    if (!compressedBase64 && imagePreview) {
      alert("파일 인코딩 작업이 아직 진행 중입니다. 1~2초 후 다시 시도해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: studentName.trim(),
          birthDate: birthDate.trim(),
          trainingName: "", // Server sets "판독 대기 중 (AI 분석 버튼을 클릭하세요)"
          imageUrl: compressedBase64 || imagePreview || "",
          notes: notes.trim() || "사용자 직접 제출"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "수료증 저장 오류");
      }

      setSubmissionSuccess(true);
      onSuccess(); // Triggers parent reload or status update
    } catch (err: any) {
      console.error(err);
      alert("수료증 저장 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Submitter Form for next turn
  const resetForm = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setCompressedBase64(null);
    setStudentName("");
    setBirthDate("");
    setNotes("");
    setSubmissionSuccess(false);
    setIsPdf(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
      
      {/* SUCCESS CONFIRMATION STATE */}
      {submissionSuccess ? (
        <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl shadow-emerald-50/50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 mb-6 font-sans">
            <CheckCircle2 className="h-10 w-10 animate-scale" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">수료증 정상 제출 완료!</h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            제출하신 수료증 파일과 성명, 생년월일 정보가 정상적으로 저장되었습니다.<br />
            관리자가 확인 및 AI 분석을 거쳐 수료 대장에 일괄 등재하게 됩니다.
          </p>

          <div className="mt-8 border-y border-slate-100 py-6 text-left max-w-sm mx-auto space-y-3 font-sans">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">제출 형태</span>
              <span className="font-semibold text-slate-800">훈련이수증 사진 제출</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">제출 수강자</span>
              <span className="font-semibold text-slate-800">{studentName} 님</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">기입 생년월일</span>
              <span className="font-semibold text-slate-800">{birthDate}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              다른 수료증 추가 제출하기
            </button>
          </div>
        </div>
      ) : (
        /* PRIMARY SUBMISSION FORM UI */
        <div className="space-y-8">
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">수료증 제출 시스템</h2>
            <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
              수료생 여러분의 정보를 정확히 입력하고, 수료증을 촬영하거나 캡처 이미지로 파일로 올려주세요.
            </p>
          </div>

          {/* DRAG AND DROP ZONE */}
          {!imagePreview ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerSelectFile}
              className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 cursor-pointer ${
                isDragOver 
                  ? "border-sky-500 bg-sky-50/40" 
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition duration-200">
                <Upload className="h-6 w-6" />
              </div>
              
              <h3 className="mt-4 text-sm font-semibold text-slate-800">
                훈련 수료증 사진 파일을 끌어다 놓거나 클릭하여 선택
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed font-sans">
                PNG, JPG, JPEG 이미지 파일 및 PDF 파일 업로드 가능<br />
                스마트폰 카메라로 수료증이 잘 보이게 찍어서 첨부하셔도 좋습니다.
              </p>
            </div>
          ) : (
            /* IMAGE/PDF LOADED VIEW */
            <div className="space-y-6">
              
              {/* Image/PDF Preview Card */}
              <div className="relative rounded-2xl border border-slate-100 bg-white p-3 shadow-xs">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center">
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-8 rounded-xl border border-slate-100 w-full">
                      <FileText className="h-16 w-16 text-indigo-500 mb-2" />
                      <p className="text-sm font-bold text-slate-700 max-w-sm truncate text-center">
                        {selectedFile?.name || "수료증.pdf"}
                      </p>
                      <span className="text-11xs text-slate-400 mt-1 font-mono">
                        {(selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : "0")} MB • PDF Document
                      </span>
                    </div>
                  ) : (
                    <img
                      src={imagePreview}
                      alt="Certificate preview"
                      className="h-full w-full object-contain"
                    />
                  )}
                  
                  {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 p-4 text-white backdrop-blur-xs">
                      <Loader2 className="h-8 w-8 animate-spin text-sky-400 mb-2" />
                      <h4 className="text-xs font-bold font-sans">수료증 파일 압축 및 최적화 중...</h4>
                    </div>
                  )}
                </div>

                {!isProcessing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-slate-900 transition shadow-sm cursor-pointer"
                    title="다른 사진 선택"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* DETAILS FORM */}
              <form onSubmit={handleSubmitCertificate} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-5">
                <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2.5 font-sans">
                  인적 사항 및 정보 기입
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Name of Trainee */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="studentName">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      이름 (성명) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="studentName"
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="성명을 정확하게 입력"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                    />
                  </div>

                  {/* Birth Date */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="birthDate">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      생년월일 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="birthDate"
                      type="text"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      placeholder="예) 850505 (6자리)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                    />
                  </div>
                </div>

                {/* Optional description notes for normal users */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="notes">
                    메모 (선택사항)
                  </label>
                  <input
                    id="notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="행정실에 알릴 말씀이나 기타 참고사항 입력"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end font-sans">
                  <button
                    type="submit"
                    disabled={isSubmitting || isProcessing}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-xs px-6 py-3 shadow-md hover:shadow-lg shadow-sky-100 cursor-pointer disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        수료증 정보 전송 및 저장 중...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        수료증 정보 제출하기
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
