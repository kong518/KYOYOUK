/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Certificate {
  id: string;
  studentName: string;
  birthDate: string; // Trainee birth date (e.g., 1995.05.20)
  trainingName: string;
  completionDate: string;
  hours: number;
  issuingOrg: string;
  certificateNo?: string; // Optional since the user requested serial is not needed
  imageUrl: string; // Compressed base64 representation of the certificate image
  submittedAt: string; // ISO 8601 Timestamp of submission
  notes?: string;
}

export interface AnalysisResult {
  studentName: string;
  birthDate: string; // Trainee birth date (e.g., 1995.05.20)
  trainingName: string;
  completionDate: string;
  hours: number;
  issuingOrg: string;
  certificateNo?: string;
  confidenceScore: number;
  summary: string;
}
