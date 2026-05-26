/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Certificate } from "./types";

/**
 * Compresses an image file using HTML Canvas.
 * Resizes the image to fit within maxWidth/maxHeight and encodes it as JPEG with specified quality.
 */
export function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<{ base64: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context is not available"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Len = dataUrl.length - `data:image/jpeg;base64,`.length;
        const approxSize = Math.round((base64Len * 3) / 4);

        resolve({
          base64: dataUrl,
          size: approxSize,
        });
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Standardizes raw date strings into human-readable completion formats (Korean style)
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  
  // Clean up format
  const cleaned = dateStr.replace(/[.\-/]/g, ".").trim();
  return cleaned;
}

/**
 * Exports the array of Certificates as a Excel/CSV file (using BOM to support Korean encoding).
 */
export function exportToCSV(certificates: Certificate[]): void {
  const headers = [
    "제출일시",
    "수강생 성명",
    "생년월일",
    "교육 과정명",
    "수료 일자",
    "교육 시간",
    "수료 기관(발급 처)"
  ];

  const rows = certificates.map((c) => [
    new Date(c.submittedAt).toLocaleString("ko-KR"),
    c.studentName,
    c.birthDate || "",
    c.trainingName,
    c.completionDate,
    `${c.hours}시간`,
    c.issuingOrg
  ]);

  // Use Excel UTF-8 BOM to prevent MS Excel Korean encoding issues
  const csvContent = [
    headers.join(","),
    ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `교육수료증_정리목록_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats and prints the selected certificates as a formal administrative report.
 */
export function printCertificatesTable(certificates: Certificate[]): void {
  const totalCount = certificates.length;
  const totalHours = certificates.reduce((sum, c) => sum + (c.hours || 0), 0);
  const averageHours = totalCount > 0 ? (totalHours / totalCount).toFixed(1) : "0.0";
  const printDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("인쇄 팝업 창이 차단되었습니다. 주소창의 팝업 차단을 해제해 주세요.");
    return;
  }

  const rowsHtml = certificates
    .map((c, i) => `
      <tr>
        <td style="text-align: center;">${i + 1}</td>
        <td style="font-weight: bold;">${c.studentName}</td>
        <td style="text-align: center;">${c.birthDate || "-"}</td>
        <td>${c.trainingName}</td>
        <td style="text-align: center;">${formatDate(c.completionDate)}</td>
        <td style="text-align: center; font-weight: bold;">${c.hours > 0 ? c.hours + 'H' : "-"}</td>
        <td>${c.issuingOrg || "-"}</td>
      </tr>
    `)
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>교육 관리 대장</title>
      <style>
        body {
          font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
          color: #111;
          margin: 40px 30px;
          line-height: 1.4;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 26px;
          font-weight: 800;
          margin: 0;
          padding-bottom: 5px;
          border-bottom: 3px double #000;
          display: inline-block;
          letter-spacing: 2px;
        }
        .meta-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        table {
          width: 105%;
          border-collapse: collapse;
          margin-bottom: 25px;
          font-size: 11px;
        }
        th, td {
          border: 1px solid #111;
          padding: 8px 6px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
          font-weight: bold;
          text-align: center;
        }
        .summary-box {
          border: 2px solid #000;
          background-color: #fafafa;
          padding: 12px;
          margin-bottom: 40px;
          display: flex;
          justify-content: space-around;
          font-size: 13px;
          font-weight: bold;
        }
        .summary-box span {
          color: #3182ce;
        }
        .signature-section {
          margin-top: 60px;
          text-align: center;
        }
        .signature-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 50px;
        }
        .signature-lines {
          display: flex;
          justify-content: flex-end;
          gap: 50px;
          margin-top: 30px;
        }
        .sig-box {
          border: 1px solid #000;
          width: 120px;
          height: 80px;
          display: flex;
          flex-direction: column;
        }
        .sig-header {
          border-b: 1px solid #000;
          background-color: #f3f4f6;
          font-size: 10px;
          font-weight: bold;
          text-align: center;
          padding: 2px 0;
          border-bottom: 1px solid #111;
        }
        .sig-body {
          flex: 1;
        }
        @media print {
          body {
            margin: 20px 10px;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div class="header">
        <h1>교 육 관 리 대 장</h1>
      </div>

      <div class="meta-info">
        <div>출력일: ${printDate}</div>
        <div>총 이수 실적: ${totalCount}건</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 4%;">순번</th>
            <th style="width: 10%;">성명</th>
            <th style="width: 12%;">생년월일</th>
            <th>교육 과정명</th>
            <th style="width: 14%;">이수일자</th>
            <th style="width: 10%;">이수시간</th>
            <th style="width: 18%;">발급/실시기관</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="summary-box">
        <div>총 교육 이수: <span>${totalCount}건</span></div>
        <div>누적 교육 이수 시간: <span>${totalHours}시간</span></div>
        <div>평균 교육 시간: <span>${averageHours}시간</span></div>
      </div>

      <div class="signature-section">
        <div class="signature-title">위와 같이 소속 임직원의 교육 관리 이수 대장을 보고합니다.</div>
        
        <div style="font-size: 13px; font-weight: bold; text-align: right; margin-right: 20px;">
          신고일: &nbsp; &nbsp; &nbsp; &nbsp; 년 &nbsp; &nbsp; 월 &nbsp; &nbsp; 일
        </div>

        <div class="signature-lines">
          <div class="sig-box">
            <div class="sig-header">담당자</div>
            <div class="sig-body"></div>
          </div>
          <div class="sig-box">
            <div class="sig-header">결재/확인자</div>
            <div class="sig-body"></div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Formats and prints a single formal "Education Completion Report" (교육 이수 명세서).
 */
export function printSingleCertificate(c: Certificate): void {
  const printDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const completeDateFormatted = formatDate(c.completionDate);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("인쇄 팝업 창이 차단되었습니다. 주소창의 팝업 차단을 해제해 주세요.");
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>교육 이수 확인서 - ${c.studentName}</title>
      <style>
        body {
          font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
          color: #111;
          margin: 60px 40px;
          line-height: 1.6;
        }
        .outer-border {
          border: 4px double #111;
          padding: 40px;
          height: 80vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .title {
          text-align: center;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 4px;
          margin-top: 20px;
          margin-bottom: 50px;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 40px;
        }
        .info-table th, .info-table td {
          border: 1px solid #111;
          padding: 12px 15px;
          font-size: 14px;
        }
        .info-table th {
          background-color: #f9fafb;
          font-weight: bold;
          width: 25%;
          text-align: center;
        }
        .info-table td {
          text-align: left;
        }
        .declaration {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          margin-top: 40px;
          margin-bottom: 40px;
          line-height: 1.8;
        }
        .date-signature {
          text-align: center;
          margin-top: 50px;
        }
        .date-text {
          font-size: 15px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .org-text {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 2px;
        }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div class="outer-border">
        <div>
          <div class="title">교 육 이 수 확 인 서</div>

          <table class="info-table">
            <tr>
              <th>성 &nbsp; &nbsp; &nbsp; 명</th>
              <td style="font-weight: bold; font-size: 16px;">${c.studentName}</td>
            </tr>
            <tr>
              <th>생 년 월 일</th>
              <td>${c.birthDate || "-"}</td>
            </tr>
            <tr>
              <th>교 육 과 정</th>
              <td style="font-weight: bold;">${c.trainingName}</td>
            </tr>
            <tr>
              <th>교 육 시 간</th>
              <td>${c.hours > 0 ? c.hours + "시간" : "확인 불가"}</td>
            </tr>
            <tr>
              <th>수 료 일 자</th>
              <td>${completeDateFormatted}</td>
            </tr>
            <tr>
              <th>발 급 기 관</th>
              <td>${c.issuingOrg || "-"}</td>
            </tr>
          </table>
        </div>

        <div>
          <div class="declaration">
            위 사람은 상기와 같이 정해진 교육 훈련 과정을<br>
            성실히 수료하였음을 공식적으로 확인합니다.
          </div>

          <div class="date-signature">
            <div class="date-text">${completeDateFormatted}</div>
            <div class="org-text">${c.issuingOrg || "기 관 명"} &nbsp;(직인생략)</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
