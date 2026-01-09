import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class NgrokInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Add ngrok-skip-browser-warning header to bypass the ngrok browser warning page
    request = request.clone({
      setHeaders: {
        'ngrok-skip-browser-warning': 'true'
      }
    });

    return next.handle(request);
  }
}
