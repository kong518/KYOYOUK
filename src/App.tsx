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
  Printer
} from "lucide-react";
import Header from "./components/Header";
import CertificateSubmission from "./components/CertificateSubmission";
import { Certificate } from "./types";
import { formatDate, exportToCSV, printCertificatesTable, printSingleCertificate } from "./utils";

export default function App() {
  // Views
  const [currentView, setCurrentView] = useState<"submit" | "admin">("submit");
  
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
            ) : filteredCertificates.length === 0 ? (
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
                <div className="text-slate-500 text-xs flex flex-col items-center gap-1.5">
                  <Award className="h-10 w-10 text-slate-700 animate-pulse" />
                  수료증 원본 서류 사진이 유실되었습니다.
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
      {/* MODAL 3: SECURE DELETION CONFIRMATION DIALOG */}
      {/* ========================================================= */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <Trash2 className="h-6 w-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-950">정말 이 수료증 데이터를 삭제하시겠습니까?</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                이 작업은 되돌릴 수 없으며, 저장된 원본 수증 문건과 분석 데이터가 데이터베이스에서 영구적으로 격리·폐기됩니다.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3.5 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 cursor-pointer transition"
              >
                취소
              </button>
              <button
                onClick={() => {
                  handleDeleteCert(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-3 shadow-md shadow-rose-50 cursor-pointer transition"
              >
                안전하게 대영 삭제
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
