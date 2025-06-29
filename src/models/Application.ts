export interface Application {
  id: string;
  internship_id: string;
  student_id: string;
  cover_letter: string;
  resume_url?: string;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  applied_at: Date;
  reviewed_at?: Date;
  response_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateApplicationData {
  internship_id: string;
  student_id: string;
  cover_letter: string;
  resume_url?: string;
}

export interface UpdateApplicationData {
  status?: 'pending' | 'reviewed' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  response_message?: string;
}