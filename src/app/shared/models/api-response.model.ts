export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}
