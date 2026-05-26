/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Award,
  FileSpreadsheet,
  Search,
  Trash2,
  Edit3,
  ExternalLink,
  Calendar,
  Building,
  Clock,
  FileText,
  X,
  Sparkles,
  Lock,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Activity,
  User,
  CalendarDays,
  Printer,
  Plus,
  Upload
} from "lucide-react";
import { read, utils } from "xlsx";
import Header from "./components/Header";
import CertificateSubmission from "./components/CertificateSubmission";
import { Certificate } from "./types";
import { formatDate, exportToCSV, printCertificatesTable, printSingleCertificate } from "./utils";

export default function App() {
  // Views
  const [currentView, setCurrentView] = useState<"submit" | "admin">("submit");
  
  // Admin Subsection Tab (list: 전체 수료 내역 목록, traineeStats: 수강생별 통계 대장)
  const [adminTab, setAdminTab] = useState<"list" | "traineeStats">("list");

  // Create Manual Certificate State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSavingNew, setIsSavingNew] = useState<boolean>(false);
  const [manualOrExcelTab, setManualOrExcelTab] = useState<"manual" | "excel">("manual");
  const [excelPreviewData, setExcelPreviewData] = useState<any[]>([]);
  const [isSavingExcel, setIsSavingExcel] = useState<boolean>(false);
  const [newForm, setNewForm] = useState<{
    studentName: string;
    birthDate: string;
    trainingName: string;
    completionDate: string;
    hours: number;
    issuingOrg: string;
  }>({
    studentName: "",
    birthDate: "",
    trainingName: "",
    completionDate: "",
    hours: 0,
    issuingOrg: ""
  });
  
  // Data State
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendHealth, setBackendHealth] = useState<{ hasGeminiKey: boolean; status: string } | null>(null);

  // Authentication State
  const [adminPasswordVerified, setAdminPasswordVerified] = useState<boolean>(() => {
    return localStorage.getItem("admin_verified") === "true";
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStudentName, setFilterStudentName] = useState<string>("");
  const [filterHours, setFilterHours] = useState<string>("all"); // "all", "short" (<4), "medium" (4-10), "long" (>10)

  // Certificate Modal / Editing State
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<{
    studentName: string;
    birthDate: string;
    trainingName: string;
    completionDate: string;
    hours: number;
    issuingOrg: string;
    notes: string;
  }>({
    studentName: "",
    birthDate: "",
    trainingName: "",
    completionDate: "",
    hours: 0,
    issuingOrg: "",
    notes: ""
  });
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Load initial health and certificate data
  useEffect(() => {
    checkHealth();
    fetchCertificates();
  }, []);

  const checkHealth = async () => {
    try {
      const resp = await fetch("/api/health");
      if (resp.ok) {
        const data = await resp.json();
        setBackendHealth(data);
      }
    } catch (e) {
      console.error("Health check failed", e);
    }
  };

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/certificates");
      if (resp.ok) {
        const data = await resp.json();
        setCertificates(data);
      }
    } catch (e) {
      console.error("Failed to fetch certificates:", e);
    } finally {
      setLoading(false);
    }
  };

  // Submit manual certificate
  const handleCreateCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.studentName.trim() || !newForm.trainingName.trim()) {
      alert("수강자명과 교육 과정명은 필수 입력 항목입니다.");
      return;
    }
    setIsSavingNew(true);
    try {
      const resp = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newForm,
          imageUrl: "" // Manual submission doesn't require image
        })
      });
      if (resp.ok) {
        const created = await resp.json();
        setCertificates(prev => [created, ...prev]);
        setIsCreateModalOpen(false);
        // Reset form
        setNewForm({
          studentName: "",
          birthDate: "",
          trainingName: "",
          completionDate: "",
          hours: 0,
          issuingOrg: ""
        });
      } else {
        const errorData = await resp.json();
        alert("등록 실패: " + errorData.error);
      }
    } catch (err: any) {
      alert("수동 저장 처리 과정 도중 에러가 발생했습니다: " + err.message);
    } finally {
      setIsSavingNew(false);
    }
  };

  // Excel File Parsing Logic with flexible mapping and date conversion
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;
        
        // Use Uint8Array ArrayBuffer representation for robust modern parsing
        const arrayBuffer = new Uint8Array(data as ArrayBuffer);
        const workbook = read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json<any>(sheet);

        if (jsonData.length === 0) {
          alert("업로드된 엑셀 파일 기재 내용이 없거나 빈 시트입니다.");
          return;
        }

        const parsed: any[] = [];
        
        jsonData.forEach((row: any) => {
          let studentName = "";
          let birthDate = "";
          let trainingName = "";
          let completionDate = "";
          let hours = 0;
          let issuingOrg = "";

          Object.keys(row).forEach((k) => {
            const val = row[k];
            if (val === undefined || val === null) return;
            
            const keyClean = k.trim().replace(/\s+/g, "").toLowerCase();

            // Name aliases
            if (["성명", "이름", "수강자", "수강생", "수강생명", "교육생", "교육생명", "훈련생", "훈련생명", "피교육자", "대상자", "이름칭", "성명칭", "studentname", "name", "trainee"].includes(keyClean)) {
              studentName = String(val).trim();
            }
            // BirthDate aliases
            else if (["생년월일", "주민등록번호", "생년월일6자리", "생일", "성별", "주민번호", "birth", "birthdate", "birthday"].includes(keyClean)) {
              let rawVal = String(val).trim();
              if (rawVal.includes("-")) {
                rawVal = rawVal.split("-")[0].trim();
              }
              // Strip extra spaces, alphabetic characters, leave numeric and dot separators
              birthDate = rawVal.replace(/[^0-9.]/g, "");
            }
            // Training Name aliases
            else if (["교육과정명", "과정명", "교육과정", "교육명", "과목", "훈련과정명", "훈련명", "과목명", "수강역량명", "trainingname", "course", "coursename"].includes(keyClean)) {
              trainingName = String(val).trim();
            }
            // Complete/Completion Date aliases
            else if (["수료일자", "이수일자", "수료일", "이수일", "일자", "수료일시", "이수일시", "수료연월일", "이수연월일", "date", "completiondate"].includes(keyClean)) {
              if (typeof val === 'number') {
                try {
                  const dateObj = new Date((val - 25569) * 86400 * 1000);
                  const y = dateObj.getFullYear();
                  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                  const d = String(dateObj.getDate()).padStart(2, '0');
                  completionDate = `${y}-${m}-${d}`;
                } catch {
                  completionDate = String(val);
                }
              } else {
                let sVal = String(val).trim();
                sVal = sVal.replace(/\s+/g, "").replace(/\//g, "-").replace(/\./g, "-");
                completionDate = sVal;
              }
            }
            // Hours aliases
            else if (["이수시간", "교육시간", "이수 시간", "교육 시간", "시간", "시수", "hours", "time", "duration"].includes(keyClean)) {
              const numericMatch = String(val).replace(/[^0-9]/g, "");
              const parsedHours = parseInt(numericMatch, 10);
              hours = isNaN(parsedHours) ? 0 : parsedHours;
            }
            // Issuing institution organization aliases
            else if (["발급기관", "실시기관", "발급처", "실시처", "기관명", "기관", "수행기관", "발급 및 실시기관", "실시 및 발급기관", "수료기관", "issuingorg", "org", "institution"].includes(keyClean)) {
              issuingOrg = String(val).trim();
            }
          });

          // Validate that all mandatory fields are completely filled: studentName, trainingName, birthDate, and hours (> 0)
          if (studentName && trainingName && birthDate && hours > 0) {
            parsed.push({
              studentName,
              birthDate,
              trainingName,
              completionDate: completionDate || "",
              hours,
              issuingOrg: issuingOrg || "",
              notes: "엑셀 파일 업로드 일괄 등록 대장"
            });
          }
        });

        if (parsed.length === 0) {
          alert("매칭 기준에 맞는 유효한 교육생 수강 정보 열(Column)을 발견할 수 없습니다. 컬럼 헤더(Headers) 이름을 확인해 주십시오.");
          return;
        }

        setExcelPreviewData(parsed);
      } catch (err: any) {
        alert("액셀 해석 처리 중 예상치 못한 상태가 발생했습니다: " + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // Bulk Submit logic
  const handleExcelBulkSubmit = async () => {
    if (excelPreviewData.length === 0) return;
    setIsSavingExcel(true);
    try {
      const resp = await fetch("/api/certificates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: excelPreviewData })
      });
      if (resp.ok) {
        const resData = await resp.json();
        alert(`성공적으로 총 ${resData.count}건의 수강 이수 정보가 일괄 등록되었습니다!`);
        fetchCertificates();
        setIsCreateModalOpen(false);
        setExcelPreviewData([]);
        setManualOrExcelTab("manual");
      } else {
        const err = await resp.json();
        alert("일괄 처리 실패: " + err.error);
      }
    } catch (err: any) {
      alert("전송 서버 연결 장애가 발생했습니다: " + err.message);
    } finally {
      setIsSavingExcel(false);
    }
  };

  // Admin credentials checker (Password required: 5612)
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "5612") {
      setAdminPasswordVerified(true);
      localStorage.setItem("admin_verified", "true");
      setIsAuthModalOpen(false);
      setAuthError(null);
      setCurrentView("admin");
      setPasswordInput("");
    } else {
      setAuthError("잘못된 비밀번호입니다. 다시 시도해 주세요. (관리실 암호는 사용자 지정 번호입니다.)");
    }
  };

  const handleLogoutAdmin = () => {
    setAdminPasswordVerified(false);
    localStorage.removeItem("admin_verified");
    setCurrentView("submit");
  };

  // Open Edit Mode
  const handleStartEdit = (cert: Certificate) => {
    setIsEditing(true);
    setEditForm({
      studentName: cert.studentName,
      birthDate: cert.birthDate || "",
      trainingName: cert.trainingName,
      completionDate: cert.completionDate,
      hours: cert.hours,
      issuingOrg: cert.issuingOrg,
      notes: cert.notes || ""
    });
  };

  // Save Manuel Edits
  const handleSaveEdit = async (id: string) => {
    setIsSavingEdit(true);
    try {
      const resp = await fetch(`/api/certificates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (resp.ok) {
        const updated = await resp.json();
        // Update local state
        setCertificates(prev => prev.map(c => c.id === id ? updated : c));
        setSelectedCert(updated);
        setIsEditing(false);
      } else {
        const errorData = await resp.json();
        alert("수정 실패: " + errorData.error);
      }
    } catch (e: any) {
      alert("네트워크 연결 실패: " + e.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Action
  const handleDeleteCert = async (id: string) => {
    try {
      const resp = await fetch(`/api/certificates/${id}`, {
        method: "DELETE"
      });
      if (resp.ok) {
        setCertificates(prev => prev.filter(c => c.id !== id));
        setSelectedCert(null);
        setShowDeleteConfirm(null);
      } else {
        alert("삭제 처리에 실패했습니다.");
      }
    } catch (e: any) {
      alert("오류 수료증 제거 에러: " + e.message);
    }
  };

  // Filtered Certificates
  const filteredCertificates = certificates.filter(c => {
    // 1. Text Query Search (StudentName, BirthDate, CourseName, IssuingOrg, Notes)
    const matchesSearch = 
      c.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.birthDate || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.trainingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.issuingOrg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.notes || "").toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Trainee filter dropdown (Strict match if selected)
    const matchesTrainee = filterStudentName === "" || c.studentName === filterStudentName;

    // 3. Training hours filter
    let matchesHours = true;
    if (filterHours === "short") {
      matchesHours = c.hours < 4;
    } else if (filterHours === "medium") {
      matchesHours = c.hours >= 4 && c.hours <= 10;
    } else if (filterHours === "long") {
      matchesHours = c.hours > 10;
    }

    return matchesSearch && matchesTrainee && matchesHours;
  });

  // Unique names of student for filtering
  const uniqueStudentNames = Array.from(new Set(certificates.map(c => c.studentName)));

  // Define Student Statistics interface
  interface StudentStats {
    studentName: string;
    birthDate: string;
    totalCount: number;
    totalHours: number;
    courses: string[];
  }

  const getStudentStats = (): StudentStats[] => {
    const statsMap: { [name: string]: StudentStats } = {};
    
    certificates.forEach(c => {
      const name = c.studentName;
      if (!statsMap[name]) {
        statsMap[name] = {
          studentName: name,
          birthDate: c.birthDate || "-",
          totalCount: 0,
          totalHours: 0,
          courses: []
        };
      }
      
      statsMap[name].totalCount += 1;
      statsMap[name].totalHours += (c.hours || 0);
      if (c.trainingName && !statsMap[name].courses.includes(c.trainingName)) {
        statsMap[name].courses.push(c.trainingName);
      }
      if ((statsMap[name].birthDate === "-" || !statsMap[name].birthDate) && c.birthDate) {
        statsMap[name].birthDate = c.birthDate;
      }
    });
    
    const statsArray = Object.values(statsMap);
    
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      return statsArray.filter(s => 
        s.studentName.toLowerCase().includes(query) ||
        s.birthDate.toLowerCase().includes(query) ||
        s.courses.some(c => c.toLowerCase().includes(query))
      );
    }
    
    return statsArray.sort((a, b) => b.totalCount - a.totalCount);
  };

  // Simple statistics calculations
  const statsTotalCount = certificates.length;
  const statsTotalHours = certificates.reduce((sum, c) => sum + (c.hours || 0), 0);
  const statsAverageHours = statsTotalCount > 0 ? (statsTotalHours / statsTotalCount).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col antialiased text-slate-900 font-sans pb-16">
      
      {/* HEADER BAR */}
      <Header
        isAdmin={adminPasswordVerified}
        onAdminLogout={handleLogoutAdmin}
      />

      <main className="flex-1">

        {/* ========================================================= */}
        {/* VIEW 1: USER / TEAM SUBMISSION */}
        {/* ========================================================= */}
        {currentView === "submit" && (
          <div className="space-y-6 pt-6 animate-fade">
            
            {/* CORE SUBMISSION UPLOAD PANEL */}
            <CertificateSubmission onSuccess={fetchCertificates} />

            {/* FOOTER-STYLE TINY ADMIN LINK AS REQUESTED */}
            <div className="pt-12 text-center">
              <button
                type="button"
                onClick={() => {
                  if (adminPasswordVerified) {
                    setCurrentView("admin");
                  } else {
                    setIsAuthModalOpen(true);
                  }
                }}
                className="text-11xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer p-2 tracking-wide font-sans rounded-lg border border-transparent hover:border-slate-200 hover:bg-white transition"
              >
                관리
              </button>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: ADMINISTRATIVE CONTROL DASHBOARD */}
        {/* ========================================================= */}
        {currentView === "admin" && adminPasswordVerified && (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10 space-y-8">
            
            {/* HEADER ZONE */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  실시간 연동 데이터베이스 활성화 중
                </div>
                <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight sm:text-3xl">수료증 관리 대시보드</h2>
                <p className="text-xs text-slate-500 mt-1">
                  제출된 모든 수료증 목록을 열람, 수정, 한글 Excel (CSV) 파일 형태로 일괄 다운로드할 수 있습니다.
                </p>
              </div>

              {/* ACTION BUTTONS ROW */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm cursor-pointer transition"
                >
                  <Plus className="h-4 w-4" />
                  교육 정보 직접 등록
                </button>

                <button
                  onClick={() => exportToCSV(filteredCertificates)}
                  disabled={filteredCertificates.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  엑셀 파일 다운로드
                </button>

                <button
                  onClick={() => printCertificatesTable(filteredCertificates)}
                  disabled={filteredCertificates.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                >
                  <Printer className="h-4 w-4" />
                  대장 인쇄하기
                </button>

                <button
                  onClick={handleLogoutAdmin}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 cursor-pointer transition"
                >
                  <Lock className="h-4 w-4 text-slate-400" />
                  관리자 로그아웃
                </button>
              </div>
            </div>

            {/* 3 STATS GRID (Reduced to 3 column bento grid) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shrink-0">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-0.5xs font-bold text-slate-400">총 수료 건수</span>
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">{statsTotalCount}건</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-0.5xs font-bold text-slate-400">누적 교육 시간</span>
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">{statsTotalHours}시간</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-0.5xs font-bold text-slate-400">평균 교육 시간</span>
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight">{statsAverageHours}시간</span>
                </div>
              </div>

            </div>

            {/* SUB-TAB TOGGLES (전체 목록 vs 교육생별 통계) */}
            <div className="flex rounded-xl bg-slate-100 p-1 max-w-md">
              <button
                onClick={() => setAdminTab("list")}
                className={`flex-1 py-2 rounded-lg text-center text-xs font-bold transition-all duration-150 cursor-pointer ${
                  adminTab === "list"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                전체 수료 내역 목록 ({filteredCertificates.length}건)
              </button>
              <button
                onClick={() => setAdminTab("traineeStats")}
                className={`flex-1 py-2 rounded-lg text-center text-xs font-bold transition-all duration-150 cursor-pointer ${
                  adminTab === "traineeStats"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                교육생별 이수 통계 ({getStudentStats().length}명)
              </button>
            </div>

            {/* SEACH & FILTER CONTROL BOX */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs space-y-4">
              
              <div className="flex flex-col md:flex-row gap-3">
                {/* Search Term */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="수강생명, 생년월일, 과정명, 발급 단체, 메모 등으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs font-medium focus:border-sky-500 focus:bg-white focus:outline-hidden transition"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")} 
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Filters */}
                <div className="grid grid-cols-2 gap-2 w-full md:w-80">
                  <div className="relative">
                    <select
                      value={filterStudentName}
                      onChange={(e) => setFilterStudentName(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-sky-500 focus:bg-white transition cursor-pointer"
                    >
                      <option value="">수강생 전체</option>
                      {uniqueStudentNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dropdown Hours Filter */}
                  <div className="relative">
                    <select
                      value={filterHours}
                      onChange={(e) => setFilterHours(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-sky-500 focus:bg-white transition cursor-pointer"
                    >
                      <option value="all">교육 시간 전체</option>
                      <option value="short">4시간 미만</option>
                      <option value="medium">4시간 ~ 10시간</option>
                      <option value="long">10시간 초과</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick statistics/feedback about filtered results */}
              <div className="flex items-center justify-between text-0.5xs text-slate-400 font-medium">
                <div>
                  조회 조건 만족 결과물: <strong className="text-slate-700 font-bold">{filteredCertificates.length}</strong> / <strong>{certificates.length}</strong>건 기재됨
                </div>
                {(searchQuery || filterStudentName || filterHours !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterStudentName("");
                      setFilterHours("all");
                    }}
                    className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    필터 조건 초기화
                  </button>
                )}
              </div>

            </div>

            {/* MASTER DATA TABLE OR EMPTY STATE */}
            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-16 text-center">
                <div className="relative flex h-10 w-10 items-center justify-center mb-3">
                  <Activity className="h-6 w-6 text-sky-500 animate-pulse" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">인증 데이터베이스 호출 중...</h4>
                <p className="text-xs text-slate-400 mt-1">잠시만 기다려주시기 바랍니다.</p>
              </div>
            ) : adminTab === "list" ? (
              filteredCertificates.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-20 text-center px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 mb-4">
                    <Award className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">일치하는 수료증이 없습니다.</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-sm">
                    {certificates.length === 0 
                      ? "아직 등록된 수료증 정보가 존재하지 않습니다." 
                      : "구성한 필터 검색 조건에 만족하는 제출 수증 결과가 존재하지 않습니다."}
                  </p>
                </div>
              ) : (
                /* REAL DATA GRID TABLE FOR DESKTOP & FLUID LIST FOR CARDS */
                <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-xs">
                  
                  {/* Desktop and Tablet table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-0.5xs font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-4 px-6 font-sans">수강자 성명</th>
                          <th className="py-4 px-6 font-sans text-center">수료증 사진</th>
                          <th className="py-4 px-6 font-sans">생년월일</th>
                          <th className="py-4 px-6 font-sans">교육 과정명</th>
                          <th className="py-4 px-6 font-sans">수료 일자</th>
                          <th className="py-4 px-6 font-sans text-center">이수 시간</th>
                          <th className="py-4 px-6 font-sans">발급 기관</th>
                          <th className="py-4 px-6 text-right font-sans">관리 옵션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredCertificates.map(cert => (
                          <tr 
                            key={cert.id}
                            className="hover:bg-slate-50/50 transition duration-150 group cursor-pointer"
                            onClick={() => {
                              setSelectedCert(cert);
                              setIsEditing(false);
                            }}
                          >
                            {/* Name of student */}
                            <td className="py-3.5 px-6 font-semibold text-slate-900 font-sans">
                              {cert.studentName}
                            </td>
                            {/* Certificate Image Thumbnail */}
                            <td className="py-2 px-6 text-center" onClick={(e) => {
                              if (cert.imageUrl) {
                                e.stopPropagation();
                                setSelectedCert(cert);
                                setIsEditing(false);
                              }
                            }}>
                              <div className="flex justify-center">
                                {cert.imageUrl ? (
                                  <div className="relative group/thumb h-9 w-12 rounded-md border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center cursor-pointer hover:border-sky-500 transition duration-150 shadow-2xs">
                                    <img 
                                      src={cert.imageUrl} 
                                      alt="Thumbnail" 
                                      className="h-full w-full object-cover group-hover/thumb:scale-110 transition duration-150" 
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition duration-150 text-white">
                                      <Search className="h-3.5 w-3.5" />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs font-semibold select-none font-mono">-</span>
                                )}
                              </div>
                            </td>
                            {/* BirthDate */}
                            <td className="py-3.5 px-6 font-semibold text-indigo-600 font-sans">
                              {cert.birthDate || "-"}
                            </td>
                            {/* Course Training Title */}
                            <td className="py-3.5 px-6 font-medium text-slate-800 max-w-[240px] truncate font-sans">
                              {cert.trainingName}
                            </td>
                            {/* Complete Date */}
                            <td className="py-3.5 px-6 text-slate-500 font-medium font-sans">
                              {formatDate(cert.completionDate)}
                            </td>
                            {/* Hours */}
                            <td className="py-3.5 px-6 text-center font-semibold text-slate-700 font-sans">
                              {cert.hours > 0 ? `${cert.hours}H` : "-"}
                            </td>
                            {/* Issuing Institution */}
                            <td className="py-3.5 px-6 text-slate-500 font-medium font-sans">
                              {cert.issuingOrg || "-"}
                            </td>
                            {/* Controls */}
                            <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setSelectedCert(cert);
                                    setIsEditing(false);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                                  title="상세 사진 보기"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setSelectedCert(cert);
                                    handleStartEdit(cert);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 hover:text-sky-600 cursor-pointer"
                                  title="수정"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
  
                                <button
                                  onClick={() => setShowDeleteConfirm(cert.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                    title="제거"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
  
                  {/* Mobile list view cards */}
                  <div className="md:hidden divide-y divide-slate-150">
                    {filteredCertificates.map(cert => (
                      <div 
                        key={cert.id} 
                        className="p-4 space-y-3 hover:bg-slate-50/50"
                        onClick={() => {
                          setSelectedCert(cert);
                          setIsEditing(false);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 font-sans mb-1 mr-1.5">
                              {cert.studentName}
                            </span>
                            <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 font-sans">
                              {cert.birthDate || "생년월일 미입력"}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 tracking-tight leading-snug mt-1.5">{cert.trainingName}</h4>
                          </div>
                          {cert.imageUrl && (
                            <div className="h-12 w-16 overflow-hidden rounded-lg bg-slate-100 flex-shrink-0 border border-slate-100">
                              <img src={cert.imageUrl} className="h-full w-full object-cover" />
                            </div>
                          )}
                        </div>
  
                        <div className="grid grid-cols-2 gap-2 text-0.5xs text-slate-500 font-semibold font-sans">
                          <div>📅 수료: {formatDate(cert.completionDate)} ({cert.hours}H)</div>
                          <div className="truncate">🏢 기관: {cert.issuingOrg || "-"}</div>
                        </div>
  
                        <div className="flex items-center justify-end border-t border-slate-100 pt-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedCert(cert);
                                setIsEditing(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 text-11xs font-bold px-2 py-1 cursor-pointer"
                            >
                              자세히
                            </button>
                            
                            <button
                              onClick={() => {
                                setSelectedCert(cert);
                                handleStartEdit(cert);
                              }}
                              className="text-sky-600 hover:text-sky-800 text-11xs font-bold px-2 py-1 cursor-pointer"
                            >
                              수정
                            </button>
                            
                            <button
                              onClick={() => setShowDeleteConfirm(cert.id)}
                              className="text-rose-500 hover:text-rose-800 text-11xs font-bold px-2 py-1 cursor-pointer"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
  
                </div>
              )
            ) : (
              /* 2. 교육생별 이수 현황 통계 탭 */
              getStudentStats().length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-20 text-center px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 mb-4">
                    <User className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">조회된 가용 수강생 정보가 없습니다.</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-sm">
                    현재 등록된 수료증 목록이 비어 있거나 검색 조건에 맞는 교육생이 존재하지 않습니다.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-xs animate-fade">
                  {/* Desktop and Tablet stats table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-0.5xs font-bold text-slate-400 uppercase tracking-wider font-semibold">
                          <th className="py-4 px-6 font-sans">교육생 성명</th>
                          <th className="py-4 px-6 font-sans">생년월일</th>
                          <th className="py-4 px-6 font-sans text-center">총 교육 이수 건수</th>
                          <th className="py-4 px-6 font-sans text-center">누적 인정 교육시간</th>
                          <th className="py-4 px-6 font-sans">수강 완료한 교육 과정들</th>
                          <th className="py-4 px-6 text-right font-sans">이동 행위</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {getStudentStats().map((stats, i) => (
                          <tr key={stats.studentName + "_" + i} className="hover:bg-slate-50/50 transition duration-150">
                            <td className="py-4 px-6 font-bold text-slate-900 font-sans flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-10xs font-bold font-mono">
                                {i + 1}
                              </span>
                              {stats.studentName}
                            </td>
                            <td className="py-4 px-6 font-semibold text-indigo-600 font-sans">
                              {stats.birthDate}
                            </td>
                            <td className="py-4 px-6 text-center font-extrabold text-slate-900 font-sans">
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold text-xs">
                                {stats.totalCount}건
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center font-extrabold text-indigo-600 font-sans">
                              <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">
                                {stats.totalHours}시간
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-500 font-medium font-sans">
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {stats.courses.map((course, idx) => (
                                  <span 
                                    key={idx} 
                                    className="inline-block bg-slate-100 border border-slate-200/50 rounded-md px-2 py-0.5 text-3xs text-slate-600 font-semibold truncate max-w-[200px]"
                                    title={course}
                                  >
                                    {course}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={() => {
                                  setFilterStudentName(stats.studentName);
                                  setAdminTab("list");
                                }}
                                className="text-sky-600 hover:text-sky-800 text-xs font-bold bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-100/30 transition cursor-pointer"
                              >
                                해당 내역만 보기
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile statistics list cards */}
                  <div className="md:hidden divide-y divide-slate-150">
                    {getStudentStats().map((stats, i) => (
                      <div key={stats.studentName + "_" + i} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-3xs font-extrabold font-mono">
                              {i + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-950">{stats.studentName}</span>
                            <span className="text-xs font-semibold text-slate-400">({stats.birthDate})</span>
                          </div>
                          <button
                            onClick={() => {
                              setFilterStudentName(stats.studentName);
                              setAdminTab("list");
                            }}
                            className="text-11xs font-bold text-sky-600 hover:text-sky-800 cursor-pointer"
                          >
                            내역 보기 &rarr;
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
                          <div className="bg-sky-50/60 p-2 rounded-xl border border-sky-100/30">
                            <span className="block text-10xs font-semibold text-sky-600">총 수료 실적</span>
                            <span className="text-slate-800 mt-0.5 block font-extrabold">{stats.totalCount}건</span>
                          </div>
                          <div className="bg-indigo-50/60 p-2 rounded-xl border border-indigo-100/30">
                            <span className="block text-10xs font-semibold text-indigo-600 font-sans">누적 이수시간</span>
                            <span className="text-slate-800 mt-0.5 block font-extrabold">{stats.totalHours}시간</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="block text-10xs font-bold text-slate-400 font-sans uppercase">이수한 훈련 과정들</span>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {stats.courses.map((course, idx) => (
                              <span key={idx} className="inline-block bg-slate-100 rounded px-1.5 py-0.5 text-3xs text-slate-600 font-medium">
                                {course}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

          </div>
        )}

      </main>

      {/* ========================================================= */}
      {/* MODAL 1: ID ADMIN PASSWORD PROMPT (기본값: 5612) */}
      {/* ========================================================= */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Lock className="h-4.5 w-4.5 text-sky-500" />
                관리자 비밀번호 확인
              </div>
              <button 
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthError(null);
                  setPasswordInput("");
                }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-0.5xs text-slate-400 leading-relaxed font-semibold">
              이 공간은 취합장으로, 제출자 보존 정보를 안전하게 수집 관리합니다.<br />
              지정 관리자 비밀번호를 입력하십시오.
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div className="space-y-1">
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="관리 코드 입력"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm font-semibold tracking-widest focus:border-sky-500 focus:outline-hidden transition"
                />
              </div>

              {authError && (
                <div className="text-0.5xs text-rose-500 font-semibold">{authError}</div>
              )}

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-3 shadow-md shadow-sky-50 cursor-pointer transition-all duration-150"
              >
                비밀번호 검증 후 입장
              </button>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CERTIFICATE DETAIL POPUP + MANUEL UPDATE PANEL */}
      {/* ========================================================= */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
          <div className="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            
            {/* Left side column: Certificate image renderer */}
            <div className="md:w-1/2 bg-slate-950 flex flex-col items-center justify-center p-4 relative min-h-[300px] md:min-h-auto overflow-hidden">
              {selectedCert.imageUrl ? (
                <img
                  src={selectedCert.imageUrl}
                  alt="Trainee Certificate document full"
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <div className="text-slate-500 text-xs text-center px-6 flex flex-col items-center gap-1.5">
                  <Award className="h-11 w-11 text-slate-700 animate-pulse mb-1" />
                  <p className="font-bold text-slate-400">수료증 사진이 첨부되지 않은 데이터입니다.</p>
                  <p className="text-[10px] text-slate-600 font-semibold font-sans">수동으로 직접 등록되었거나, 엑셀 파일로 일괄 업로드 작성된 내역입니다.</p>
                </div>
              )}
              
              <div className="absolute bottom-4 left-4 right-4 text-center cursor-default bg-black/50 py-1 py-1 px-3 rounded-full text-11xs text-slate-300 backdrop-blur-xs truncate max-w-[90%] mx-auto font-sans font-medium">
                파일명 or 일련번호: {selectedCert.certificateNo || "없음"}
              </div>
            </div>

            {/* Right side column: Detail sheet / Editor */}
            <div className="md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
              
              {/* Box Top */}
              <div className="space-y-5">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-0.5xs font-bold">
                    <Sparkles className="h-3 w-3 text-sky-500" />
                    수료증 세부조회 및 수정
                  </span>
                  
                  <button 
                    onClick={() => {
                      setSelectedCert(null);
                      setIsEditing(false);
                    }} 
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {isEditing ? (
                  /* EDITOR PANEL STATE */
                  <div className="space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="editStudent">수강자명</label>
                        <input
                          id="editStudent"
                          type="text"
                          value={editForm.studentName}
                          onChange={(e) => setEditForm({ ...editForm, studentName: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="editHours">훈련 시간</label>
                        <input
                          id="editHours"
                          type="number"
                          value={editForm.hours}
                          onChange={(e) => setEditForm({ ...editForm, hours: Number(e.target.value) })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="editCourse">과정 교육명</label>
                      <input
                        id="editCourse"
                        type="text"
                        value={editForm.trainingName}
                        onChange={(e) => setEditForm({ ...editForm, trainingName: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="editDate">수료 일자</label>
                        <input
                          id="editDate"
                          type="text"
                          value={editForm.completionDate}
                          onChange={(e) => setEditForm({ ...editForm, completionDate: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="editOrg">발급 기관</label>
                        <input
                          id="editOrg"
                          type="text"
                          value={editForm.issuingOrg}
                          onChange={(e) => setEditForm({ ...editForm, issuingOrg: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="editBirth">생년월일 (6자리)</label>
                      <input
                        id="editBirth"
                        type="text"
                        placeholder="예) 850505"
                        value={editForm.birthDate}
                        onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                ) : (
                  /* READ-ONLY INFO SHEET STATE */
                  <div className="space-y-5 text-left">
                    <div>
                      <span className="text-11xs font-bold text-slate-400 font-sans uppercase">교육 과정명</span>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug tracking-tight mt-0.5">
                        {selectedCert.trainingName}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 shrink-0">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block text-11xs font-bold text-slate-400 font-sans uppercase">수강생</span>
                          <span className="text-xs font-bold text-slate-800">{selectedCert.studentName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block text-11xs font-bold text-slate-400 font-sans uppercase">인정 시간</span>
                          <span className="text-xs font-bold text-slate-800">{selectedCert.hours || 0} 시간 이수</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block text-11xs font-bold text-slate-400 font-sans uppercase">수료 일자</span>
                          <span className="text-xs font-semibold text-slate-800">{formatDate(selectedCert.completionDate)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="block text-11xs font-bold text-slate-400 font-sans uppercase">인증 발급</span>
                          <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px] block">{selectedCert.issuingOrg || "-"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3.5 border-t border-slate-100 pt-4.5">
                      <div>
                        <span className="block text-11xs font-bold text-slate-400 font-sans uppercase">수강생 생년월일</span>
                        <span className="text-xs font-mono text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md mt-1 inline-block">
                          {selectedCert.birthDate || "미등록 또는 식별되지 않음"}
                        </span>
                      </div>

                      <div className="text-11xs text-slate-400 flex items-center gap-1 font-sans font-semibold pt-1">
                        <span>최초 전산 제출일:</span>
                        <span>{new Date(selectedCert.submittedAt).toLocaleString("ko-KR")}</span>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Box Footer Buttons */}
              <div className="mt-8 pt-4.5 border-t border-slate-100 flex items-center justify-between gap-2.5">
                
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs px-4 py-2.5 cursor-pointer transition"
                    >
                      취소
                    </button>
                    <button
                      disabled={isSavingEdit}
                      onClick={() => handleSaveEdit(selectedCert.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs px-5 py-2.5 shadow-sm shadow-sky-50 cursor-pointer transition"
                    >
                      {isSavingEdit ? "저장 중..." : "수정 완료"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        handleDeleteCert(selectedCert.id);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl text-rose-500 hover:bg-rose-50 font-bold text-xs px-4 py-2.5 cursor-pointer transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      자료 안전 삭제
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printSingleCertificate(selectedCert)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 py-2.5 shadow-xs cursor-pointer transition"
                      >
                        <Printer className="h-4 w-4 text-slate-400" />
                        인쇄하기
                      </button>

                      <button
                        onClick={() => handleStartEdit(selectedCert)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 shadow-sm cursor-pointer transition"
                      >
                        <Edit3 className="h-4 w-4" />
                        개별 정보 수정
                      </button>
                    </div>
                  </>
                )}

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: MANUAL OR EXCEL EDUCATION CERTIFICATE REGISTRATION */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className={`w-full ${manualOrExcelTab === "excel" && excelPreviewData.length > 0 ? "max-w-3xl" : "max-w-lg"} rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-5 my-8 transition-all duration-200`}>
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Plus className="h-5 w-5 text-sky-500" />
                수강생 교육 정보 등록 대장
              </div>
              <button 
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setExcelPreviewData([]);
                  setManualOrExcelTab("manual");
                  setNewForm({
                    studentName: "",
                    birthDate: "",
                    trainingName: "",
                    completionDate: "",
                    hours: 0,
                    issuingOrg: ""
                  });
                }} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* SELECTION TABS */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setManualOrExcelTab("manual");
                  setExcelPreviewData([]);
                }}
                className={`flex-1 py-1.8 rounded-lg text-center text-xs font-bold transition-all duration-150 cursor-pointer ${
                  manualOrExcelTab === "manual"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                수동 직접 단건 등록
              </button>
              <button
                type="button"
                onClick={() => setManualOrExcelTab("excel")}
                className={`flex-1 py-1.8 rounded-lg text-center text-xs font-bold transition-all duration-150 cursor-pointer ${
                  manualOrExcelTab === "excel"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                엑셀 파일 일괄 등록
              </button>
            </div>

            {manualOrExcelTab === "manual" ? (
              /* TAB 1: MANUAL DIRECT SINGLE INSERTION */
              <>
                <p className="text-11xs font-semibold text-slate-400 leading-relaxed font-mono">
                  * 기재하신 인적정보 및 수증 정보는 전산 관리 데이터베이스에 수동 기록되며, 목록 및 교육생별 통계에 실시간 자동 집계됩니다.
                </p>

                <form onSubmit={handleCreateCertificate} className="space-y-4 text-left">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="newStudent">수강생명 <span className="text-rose-500">*</span></label>
                      <input
                        id="newStudent"
                        type="text"
                        required
                        placeholder="예) 홍길동"
                        value={newForm.studentName}
                        onChange={(e) => setNewForm({ ...newForm, studentName: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="newBirth">생년월일 (6자리)</label>
                      <input
                        id="newBirth"
                        type="text"
                        maxLength={6}
                        placeholder="예) 850505"
                        value={newForm.birthDate}
                        onChange={(e) => setNewForm({ ...newForm, birthDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="newCourse">교육 과정명 <span className="text-rose-500">*</span></label>
                    <input
                      id="newCourse"
                      type="text"
                      required
                      placeholder="예) 사회복지 실무 역량 강화 교육"
                      value={newForm.trainingName}
                      onChange={(e) => setNewForm({ ...newForm, trainingName: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="newDate">수료 일자</label>
                      <input
                        id="newDate"
                        type="text"
                        placeholder="예) 2026.05.26 또는 2026-05-26"
                        value={newForm.completionDate}
                        onChange={(e) => setNewForm({ ...newForm, completionDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="newHours">이수 시간 (시간)</label>
                      <input
                        id="newHours"
                        type="number"
                        min={0}
                        placeholder="예) 8"
                        value={newForm.hours || ""}
                        onChange={(e) => setNewForm({ ...newForm, hours: Number(e.target.value) })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-11xs font-bold text-slate-500 font-sans" htmlFor="newOrg">실시 및 발급기관</label>
                    <input
                      id="newOrg"
                      type="text"
                      placeholder="예) 수원시장애인종합복지관"
                      value={newForm.issuingOrg}
                      onChange={(e) => setNewForm({ ...newForm, issuingOrg: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setNewForm({
                          studentName: "",
                          birthDate: "",
                          trainingName: "",
                          completionDate: "",
                          hours: 0,
                          issuingOrg: ""
                        });
                      }}
                      className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 cursor-pointer transition"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingNew}
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2.5 shadow-sm shadow-sky-50 cursor-pointer transition"
                    >
                      {isSavingNew ? "기록 저장 중..." : "교육 정보 등록 완료"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* TAB 2: EXCEL BULK FILE UPLOAD */
              <div className="space-y-4 text-left">
                
                {/* 1. EXCEL/CSV IMPORT REQUIREMENTS GUIDE PANEL */}
                <div className="rounded-xl bg-slate-50 border border-slate-150 p-3.5 space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <FileSpreadsheet className="h-4.5 w-4.5 text-sky-600" />
                    <span>엑셀 파일 업로드 항목 요건</span>
                  </div>
                  
                  <div className="text-3xs text-slate-500 space-y-1 bg-white p-2.5 rounded-lg border border-slate-100/80 font-semibold leading-relaxed">
                    <p className="pb-1 text-slate-400 font-bold border-b border-slate-100">📌 아래 [필수] 항목이 모두 기재된 행만 성공적으로 인식되어 실시간 자동 추출됩니다.</p>
                    <p>• <span className="font-bold text-slate-900">성명 또는 이름</span> (<span className="text-rose-500 font-extrabold">필수</span>)</p>
                    <p>• <span className="font-bold text-slate-900">교육명 또는 교육과정명</span> (<span className="text-rose-500 font-extrabold">필수</span>)</p>
                    <p>• <span className="font-bold text-slate-900">생년월일</span> (6자리 숫자, 예: 950505) (<span className="text-rose-500 font-extrabold">필수</span>)</p>
                    <p>• <span className="font-bold text-slate-900">이수시간</span> (<span className="text-rose-500 font-extrabold">필수</span>)</p>
                    <p>• <span className="font-bold text-slate-400">수료일자</span> (선택)</p>
                    <p>• <span className="font-bold text-slate-400">교육기관명</span> (선택)</p>
                  </div>

                  {/* EXCEL SHEET GRID MOCKUP VISUAL */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-xs">
                    <div className="bg-[#107c41] px-2.5 py-1 flex items-center justify-between text-white text-[10px] font-bold">
                      <div className="flex items-center gap-1.5 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span>교육정보_업로드_양식.xlsx</span>
                      </div>
                      <span className="text-[9px] bg-white/10 px-1.5 py-0.2 rounded text-emerald-100 font-medium">Sheet1</span>
                    </div>

                    <div className="grid grid-cols-[24px_1fr_1.5fr_1fr_1fr_1fr_1.2fr] text-center font-mono text-[9px] bg-slate-100 text-slate-500 border-b border-slate-200">
                      <div className="bg-slate-150 py-0.8 font-bold border-r border-slate-200">\</div>
                      <div className="py-0.8 border-r border-slate-200 font-bold">A</div>
                      <div className="py-0.8 border-r border-slate-200 font-bold">B</div>
                      <div className="py-0.8 border-r border-slate-200 font-bold">C</div>
                      <div className="py-0.8 border-r border-slate-200 font-bold">D</div>
                      <div className="py-0.8 border-r border-slate-200 font-bold">E</div>
                      <div className="py-0.8 font-bold">F</div>
                    </div>

                    <div className="grid grid-cols-[24px_1fr_1.5fr_1fr_1fr_1fr_1.2fr] text-center text-[9px] font-bold text-slate-800 bg-slate-50 border-b border-slate-200">
                      <div className="bg-slate-100 py-0.8 font-mono text-slate-400 border-r border-slate-200 font-medium">1</div>
                      <div className="py-0.8 border-r border-slate-200 bg-indigo-50/50 text-indigo-700">성명</div>
                      <div className="py-0.8 border-r border-slate-200 bg-indigo-50/50 text-indigo-700">교육과정명</div>
                      <div className="py-0.8 border-r border-slate-200 bg-indigo-50/50 text-indigo-700">생년월일</div>
                      <div className="py-0.8 border-r border-slate-200 bg-indigo-50/50 text-indigo-700">이수시간</div>
                      <div className="py-0.8 border-r border-slate-200 text-slate-400">수료일자</div>
                      <div className="py-0.8 text-slate-400 font-extrabold">교육기관명</div>
                    </div>

                    <div className="grid grid-cols-[24px_1fr_1.5fr_1fr_1fr_1fr_1.2fr] text-center text-[9px] text-slate-600 bg-white border-b border-slate-150 font-semibold">
                      <div className="bg-slate-50 py-1 font-mono text-slate-400 border-r border-slate-200 font-medium font-semibold">2</div>
                      <div className="py-1 border-r border-slate-200 font-bold text-slate-900">홍길동</div>
                      <div className="py-1 border-r border-slate-200 text-left px-1.5 truncate">사회복지교육</div>
                      <div className="py-1 border-r border-slate-200 font-mono text-indigo-600">850505</div>
                      <div className="py-1 border-r border-slate-200 font-mono">8</div>
                      <div className="py-1 border-r border-slate-200 font-mono text-slate-500">2026-05-26</div>
                      <div className="py-1 text-slate-500 truncate px-1.5 text-left">수원복지관</div>
                    </div>

                    <div className="grid grid-cols-[24px_1fr_1.5fr_1fr_1fr_1fr_1.2fr] text-center text-[9px] text-slate-600 bg-white font-semibold">
                      <div className="bg-slate-50 py-1 font-mono text-slate-400 border-r border-slate-200 font-medium font-semibold">3</div>
                      <div className="py-1 border-r border-slate-200 font-bold text-slate-900">김철수</div>
                      <div className="py-1 border-r border-slate-200 text-left px-1.5 truncate">소방안전과정</div>
                      <div className="py-1 border-r border-slate-200 font-mono text-indigo-600">951225</div>
                      <div className="py-1 border-r border-slate-200 font-mono">4</div>
                      <div className="py-1 border-r border-slate-200 font-mono text-slate-500">2026.04.12</div>
                      <div className="py-1 text-slate-500 truncate px-1.5 text-left">안전보건공단</div>
                    </div>
                  </div>
                </div>

                {/* 2. FILE DRAG-AND-DROP UPLOAD ZONE */}
                {excelPreviewData.length === 0 ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-sky-400 rounded-2xl bg-slate-50/50 py-9 px-4 text-center cursor-pointer transition group">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-sky-50 group-hover:text-sky-600 transition duration-150 mb-3.5">
                      <Upload className="h-5.5 w-5.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900">컴퓨터에서 교육 엑셀 파일 찾기</span>
                    <p className="mt-1 text-3xs text-slate-400 font-semibold">
                      *.xlsx, *.xls 및 *.csv 파일 형식 지원
                    </p>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                      onChange={handleExcelUpload} 
                    />
                  </label>
                ) : (
                  /* 3. EXCEL PREVIEW GRID AREA */
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h4 className="text-xs font-bold text-slate-800">
                          추출 성공한 인스턴스 데이터 ({excelPreviewData.length}건)
                        </h4>
                      </div>
                      <button
                        onClick={() => setExcelPreviewData([])}
                        className="text-11xs font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        엑셀 파일 다시 업로드
                      </button>
                    </div>

                    {/* Preview Table with scrollbar */}
                    <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                      <table className="w-full text-left text-3xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-xxs">
                            <th className="py-2.5 px-3">순번</th>
                            <th className="py-2.5 px-3">성명</th>
                            <th className="py-2.5 px-3">생년월일</th>
                            <th className="py-2.5 px-3">교육 과정명</th>
                            <th className="py-2.5 px-3">수료 일자</th>
                            <th className="py-2.5 px-3 text-center">시간</th>
                            <th className="py-2.5 px-3">수료 기관(발급처)</th>
                            <th className="py-2.5 px-3 text-center">제거</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 font-semibold">
                          {excelPreviewData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition duration-100">
                              <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 text-slate-900 font-bold">{row.studentName}</td>
                              <td className="py-2 px-3 font-sans text-indigo-600">{row.birthDate || "-"}</td>
                              <td className="py-2 px-3 text-slate-800 truncate max-w-[150px]" title={row.trainingName}>
                                {row.trainingName}
                              </td>
                              <td className="py-2 px-3">{row.completionDate || "-"}</td>
                              <td className="py-2 px-3 text-center font-bold text-slate-700">{row.hours > 0 ? `${row.hours}H` : "-"}</td>
                              <td className="py-2 px-3 truncate max-w-[110px]" title={row.issuingOrg}>{row.issuingOrg || "-"}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setExcelPreviewData(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-rose-500 text-xxs"
                                  title="목록에서 제거"
                                >
                                  <X className="h-3.5 w-3.5 inline" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* BULK ACTION BUTTON ROW */}
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreateModalOpen(false);
                          setExcelPreviewData([]);
                          setManualOrExcelTab("manual");
                        }}
                        className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 cursor-pointer transition"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleExcelBulkSubmit}
                        disabled={isSavingExcel || excelPreviewData.length === 0}
                        className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2.5 shadow-sm shadow-sky-50 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingExcel ? "일괄 등록 처리 중..." : `검출 데이터 (${excelPreviewData.length}건) 일괄 등록 완료`}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
