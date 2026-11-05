
export type FacultyRecord = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  school: string;
  createdAt: number;
};

export type FacultyRequest = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  school: string;
  createdAt: number;
  submittedByUsername: string;
  submittedByUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  customReason?: string;
};

export type FacultyListResponse = {
  status: 'success';
  faculty: FacultyRecord[];
  total: number;
};

export type ApiErrorResponse = {
  status: 'error';
  message: string;
};

export type FacultyRequestSubmissionResponse =
  | {
      status: 'success';
      message: string;
      requestId: string;
    }
  | ApiErrorResponse;

export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};
