import { Prisma } from "@prisma/client";

export class HttpException extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request', errors?: Array<{ field: string; message: string }>) {
    super(message, 400, errors);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found', errors?: Array<{ field: string; message: string }>) {
    super(message, 404, errors);
  }
}

export class ConflictException extends HttpException {
  constructor(message = 'Conflict', errors?: Array<{ field:string; message: string }>) {
    super(message, 409);
    this.errors= errors;
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message = 'Internal Server Error', errors?: Array<{ field: string; message: string }>) {
    super(message, 500, errors);
    this.errors= errors;
  } 
} 

export class PrismaErrorHandler {
  static handle(error: Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        return new ConflictException(
          `A record with this ${error.meta?.target?.toString() ?? 'field'} already exists`
        );

      case 'P2003':
        // Foreign key constraint violation
        console.log(error.message);
        return new BadRequestException(
          'Cannot perform this operation due to related records'
        );

      case 'P2025':
        // Record not found
        return new NotFoundException(
          `${error.meta?.modelName || 'Record'} not found`
        );

      case 'P2014':
        // Invalid ID
        return new BadRequestException('Invalid ID provided');

      case 'P2011':
        // Null constraint violation
        return new BadRequestException(
          `Required field ${error.meta?.target?.toString() || 'field'} cannot be null`
        );

      default:
        // Log the error for debugging
        console.error('Unhandled Prisma error:', error);
        return new InternalServerErrorException('Database operation failed');
    }
  }
}