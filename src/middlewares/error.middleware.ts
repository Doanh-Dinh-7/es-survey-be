import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { HttpException, PrismaErrorHandler } from '../exceptions/http.exception';
import { Prisma } from '@prisma/client';

export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof HttpException) {
    res.status(error.statusCode).json({
      success: false,
      statusCode: error.statusCode,
      message: error.message,
      errors: error.errors,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const handledError = PrismaErrorHandler.handle(error);
    res.status(handledError.statusCode).json({
      success: false,
      statusCode: handledError.statusCode,
      message: handledError.message,
      errors: handledError.errors,
    });
    return;
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Validation error',
      errors: error.message,
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    success: false,
    statusCode: 500,
    message: 'Internal server error',
  });
};