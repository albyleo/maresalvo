export interface Question {
  id: string;
  position: number;
  prompt: string;
  options: string[];
}
export interface Questionnaire {
  id: string;
  title: string;
  version: number;
  description: string;
  pass_percent: number;
  is_demo: boolean;
}
export interface Application {
  id: string;
  profile_id: string;
  questionnaire_title: string;
  questionnaire_version: number;
  is_demo: boolean;
  score_percent: number;
  correct_answers: number;
  total_questions: number;
  status: 'failed' | 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  review_notes: string | null;
  certificate_id: string | null;
}
export const APPLICATION_STATUS = {
  failed: 'Da ripetere', pending: 'In revisione', approved: 'Approvata', rejected: 'Respinta',
};
