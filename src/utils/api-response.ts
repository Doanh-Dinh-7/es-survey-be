export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  data?: T;
  message?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export class ApiResponseBuilder {
  static success<T>(data: T, message?: string, statusCode = 200): ApiResponse<T> {
    return {
      success: true,
      statusCode,
      data,
      message,
    };
  }

  static error(message: string, errors?: Array<{ field: string; message: string }>, statusCode = 400): ApiResponse {
    return {
      success: false,
      statusCode,
      message,
      errors,
    };
  }
} 