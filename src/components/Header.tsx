/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LogOut, Award, User } from "lucide-react";

interface HeaderProps {
  isAdmin: boolean;
  onAdminLogout: () => void;
}

export default function Header({
  isAdmin,
  onAdminLogout
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        
        {/* LOGO */}
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-md shadow-sky-100">
            <Award className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900 sm:text-lg">교육 관리 대장</h1>
            <p className="hidden text-0.5xs text-gray-400 sm:block font-medium">편리한 교육 이수 관리 및 취합</p>
          </div>
        </div>

        {/* CONTROLS SECTION */}
        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-0.5xs font-bold text-indigo-700">
                <User className="h-3.5 w-3.5 text-indigo-500" />
                <span>관리자 모드</span>
              </div>
              <button
                onClick={onAdminLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-0.5xs font-bold text-slate-600 cursor-pointer transition-all"
                title="관리실 로그아웃"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-400" />
                <span>로그아웃</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
