import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
export async function validateInput<T extends object>(
  type: new () => T,
  value: unknown,
): Promise<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Dados inválidos.');
  const instance = plainToInstance(type, value);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length)
    throw new BadRequestException({
      message: 'Confira os campos informados.',
      fields: errors.map((e) => e.property),
    });
  return instance;
}
@Catch()
export class SafeErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const code = (error as { code?: string })?.code;
    let status = error instanceof HttpException ? error.getStatus() : 500;
    if (['23503', '23514', '22P02', '22007', '22008'].includes(code ?? '')) status = 422;
    if (code === '23505') status = 409;
    const raw = error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object' && 'message' in raw
          ? raw.message
          : null;
    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        status,
        title:
          message ??
          (status === 409
            ? 'Este registro já existe.'
            : status === 422
              ? 'Os dados não são válidos para esta operação.'
              : 'Não foi possível concluir. Tente novamente.'),
        fields: raw && typeof raw === 'object' && 'fields' in raw ? raw.fields : undefined,
        requestId: response.getHeader('X-Request-Id'),
        instance: request.path,
      });
  }
}
