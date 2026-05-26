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
  Clock, 
  Sparkles, 
  AlertTriangle, 
  User, 
  Bookmark, 
  Calendar, 
  Activity, 
  Building, 
  FileText 
} from "lucide-react";
import { compressImage } from "../utils";
import { AnalysisResult } from "../types";

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
  const [processingStep, setProcessingStep] = useState<number>(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [hasAiAutofill, setHasAiAutofill] = useState(false);

  // Form Field States
  const [studentName, setStudentName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [trainingName, setTrainingName] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [hours, setHours] = useState<number>(0);
  const [issuingOrg, setIssuingOrg] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps for the AI parser
  const processingSteps = [
    "수료증 파일 감지 및 로딩...",
    "문서 해상도 최적화 및 인코딩 중...",
    "분석 서버로 서류 전송 중...",
    "텍스트 및 정보 분석 중...",
    "수강생 정보, 이수 시간, 수료 일자 매핑하는 중...",
    "수료증 분석 정보 정리 완료!"
  ];

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

  // Compress & Load File
  const processFile = async (file: File) => {
    setSelectedFile(file);
    const mime = file.type || "image/jpeg";
    setImageMimeType(mime);
    setAnalysisError(null);
    setHasAiAutofill(false);

    const isFilePdf = mime === "application/pdf";
    setIsPdf(isFilePdf);

    // Initial draft preview representation
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);

    // Start compression and analysis
    setIsProcessing(true);
    setProcessingStep(0);

    try {
      let base64 = "";

      if (isFilePdf) {
        // PDF handles reading directly via FileReader (no canvas compression)
        await new Promise((r) => setTimeout(r, 600));
        setProcessingStep(1);

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
        // Step 0 -> Step 1: Compress image
        await new Promise((r) => setTimeout(r, 600));
        setProcessingStep(1);
        
        const compressed = await compressImage(file, 1000, 1000, 0.8);
        base64 = compressed.base64;
        setCompressedBase64(base64);
        console.log(`Compressed image size: ${Math.round(compressed.size / 1024)} KB`);
      }

      // Step 2: Send metadata
      setProcessingStep(2);
      await new Promise((r) => setTimeout(r, 600));

      // Step 3: Run AI Analysis
      setProcessingStep(3);
      
      const response = await fetch("/api/ai/analyze-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: base64,
          mimeType: mime
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "분석 서버 응답 에러");
      }

      setProcessingStep(4);
      const parsedResult: AnalysisResult = await response.json();
      await new Promise((r) => setTimeout(r, 600));

      setProcessingStep(5);
      
      // Auto-fill form fields
      setStudentName(parsedResult.studentName || "");
      setBirthDate(parsedResult.birthDate || "");
      setTrainingName(parsedResult.trainingName || "");
      setCompletionDate(parsedResult.completionDate || "");
      setHours(parsedResult.hours || 0);
      setIssuingOrg(parsedResult.issuingOrg || "");
      setHasAiAutofill(true);

      setTimeout(() => {
        setIsProcessing(false);
      }, 550);

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("GEMINI_API_KEY")) {
        setAnalysisError("분석 API 키가 설정되지 않았습니다. 하지만 걱정 마세요! 인적사항을 직접 기재하여 수동으로 수료증을 등록할 수 있습니다.");
      } else {
        setAnalysisError("비대면 분석에 실패했습니다. 아래 폼에서 인적사항을 직접 기입해 주시면 수능 내용을 정상적으로 제출할 수 있습니다.");
      }
      setIsProcessing(false);
    }
  };

  // Handle Form Submission
  const handleSubmitCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !trainingName.trim()) {
      alert("수강자 성명과 교육 과정명은 필수 기입 항목입니다.");
      return;
    }

    if (!compressedBase64 && imagePreview) {
      alert("파일 인코딩 작업이 아직 완료되지 않았습니다. 잠시만 기다려주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          birthDate,
          trainingName,
          completionDate,
          hours,
          issuingOrg,
          imageUrl: compressedBase64 || imagePreview,
          notes
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "저장 오류");
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
    setTrainingName("");
    setCompletionDate("");
    setHours(0);
    setIssuingOrg("");
    setNotes("");
    setSubmissionSuccess(false);
    setHasAiAutofill(false);
    setIsPdf(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
      
      {/* SUCCESS CONFIRMATION STATE */}
      {submissionSuccess ? (
        <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl shadow-emerald-50/50">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 mb-6">
            <CheckCircle2 className="h-10 w-10 animate-scale" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">수료증 등록 완료!</h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            제출하신 수료증이 정상적으로 저장되었습니다.<br />
            관리자가 확인/취합하여 Excel 및 수료 자료로 깔끔하게 관리하게 됩니다.
          </p>

          <div className="mt-8 border-y border-slate-100 py-6 text-left max-w-sm mx-auto space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium font-sans">제출자</span>
              <span className="font-semibold text-slate-800 font-sans">{studentName} 님</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium font-sans">교육 과정명</span>
              <span className="font-semibold text-slate-800 text-right truncate max-w-[200px] font-sans">{trainingName}</span>
            </div>
            {completionDate && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium font-sans">수료 일자</span>
                <span className="font-semibold text-slate-800 font-sans">{completionDate}</span>
              </div>
            )}
            {hours > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium font-sans">교육 시간</span>
                <span className="font-semibold text-slate-800 font-sans">{hours}시간</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              다른 수료증 추가하기
            </button>
          </div>
        </div>
      ) : (
        /* PRIMARY SUBMISSION FORM UI */
        <div className="space-y-8">
          
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">수료증 제출</h2>
            <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
              제출할 수료증 파일 (이미지 또는 PDF)을 업로드해 주세요.
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
                마우스로 파일을 끌어다 놓거나 클릭하세요
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                PNG, JPG, JPEG 이미지 및 PDF 파일 지원<br />
                스마트폰 카메라 촬영 및 자료 캡처본 업로드 가능
              </p>
            </div>
          ) : (
            /* IMAGE/PDF LOADED VIEW */
            <div className="space-y-6">
              
              {/* Image/PDF Preview Card */}
              <div className="relative rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-150">
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-8 rounded-xl border border-slate-100">
                      <FileText className="h-16 w-16 text-indigo-500 animate-pulse mb-2" />
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
                  
                  {/* Processing Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/70 p-4 text-white backdrop-blur-xs">
                      <div className="relative flex h-12 w-12 items-center justify-center mb-4">
                        <Loader2 className="absolute h-10 w-10 animate-spin text-sky-400" />
                        <FileText className="h-5 w-5 text-indigo-300" />
                      </div>
                      <h4 className="text-sm font-bold tracking-tight">수료증 판독 및 분석 중...</h4>
                      <p className="mt-2.5 max-w-xs text-center text-xs text-slate-200 font-medium">
                        {processingSteps[processingStep]}
                      </p>
                      
                      {/* Interactive Progress Bar */}
                      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
                        <div 
                          className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-300" 
                          style={{ width: `${((processingStep + 1) / processingSteps.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset button only if not actively parsing */}
                {!isProcessing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-slate-900 transition shadow-sm cursor-pointer"
                    title="재업로드"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* WARNING / ERROR IN ANALYSIS */}
              {analysisError && (
                <div className="flex gap-2.5 rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-xs text-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block sm:inline">알림:</span> {analysisError}
                  </div>
                </div>
              )}

              {/* AI autofill success badge */}
              {hasAiAutofill && !isProcessing && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800 border border-emerald-100">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <div>
                    <strong>AI 판독 성공!</strong> 성명, 교육명, 수료 일자, 시간이 자동으로 기재되었습니다. 내용을 확인하신 후 제출해 주세요.
                  </div>
                </div>
              )}

              {/* DETAILS FORM */}
              <form onSubmit={handleSubmitCertificate} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md shadow-slate-50 space-y-5">
                <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-150 pb-2.5">
                  수료 세부 정보 수정/확인
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  
                  {/* Name of Trainee */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="studentName">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      수강자 성명 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="studentName"
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="수료증상의 본인 성명 기입"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                    />
                  </div>

                  {/* Hours completed */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="hours">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      교육/훈련 시간 (시간 단위)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="hours"
                        type="number"
                        min="0"
                        value={hours || ""}
                        onChange={(e) => setHours(Number(e.target.value))}
                        placeholder="0"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                      />
                      <span className="text-xs font-bold text-slate-500 font-sans shrink-0">시간</span>
                    </div>
                  </div>

                </div>

                {/* Course Title */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="trainingName">
                    <Bookmark className="h-3.5 w-3.5 text-slate-400" />
                    교육 과정명 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="trainingName"
                    type="text"
                    required
                    value={trainingName}
                    onChange={(e) => setTrainingName(e.target.value)}
                    placeholder="수료증상의 정확한 교육/훈련 행사 과정명 기재"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  
                  {/* Date of completion */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="completionDate">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      수료 일자
                    </label>
                    <input
                      id="completionDate"
                      type="text"
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      placeholder="예) 2026-05-12"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                    />
                  </div>

                  {/* Issuing Institution */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="issuingOrg">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      발급 기관 (수료 기관)
                    </label>
                    <input
                      id="issuingOrg"
                      type="text"
                      value={issuingOrg}
                      onChange={(e) => setIssuingOrg(e.target.value)}
                      placeholder="수료증을 발급한 정식 단체/센터명"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-sky-500 focus:outline-hidden transition"
                    />
                  </div>

                </div>

                {/* Birth Date */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 font-sans" htmlFor="birthDate">
                    <User className="h-3.5 w-3.5 text-indigo-400" />
                    수강생 생년월일 <span className="text-rose-500">*</span>
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

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || isProcessing}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold text-xs px-6 py-3 shadow-md hover:shadow-lg shadow-sky-100 cursor-pointer disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        저장 완료하는 중...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        인증 수료증 등록완료
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
