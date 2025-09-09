import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { BadRequestException } from '../exceptions/http.exception';

export const validate = (schema: AnyZodObject): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new BadRequestException(
            'Validation failed',
            error.errors.map((err) => ({
              field: err.path.length > 0 ? err.path.join('.') : 'body',
              message: err.message,
            }))
          )
        );
      } else {
        next(error);
      }
    }
  };
};