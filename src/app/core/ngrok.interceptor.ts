import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable, timeout } from 'rxjs';

@Injectable()
export class NgrokInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Add ngrok-skip-browser-warning header to bypass the ngrok browser warning page
    let modifiedReq = request.clone({
      setHeaders: {
        'ngrok-skip-browser-warning': 'true'
      }
    });

    // Differentiate timeouts based on request type
    // ✅ TIFF validation/metadata requests need more time for large files
    const isTiffValidationRequest = modifiedReq.url.includes('/validate-tiff') || 
                                    modifiedReq.url.includes('/tiff-metadata');
    const isSegmentationRequest = modifiedReq.url.includes('/segment') || 
                                   modifiedReq.url.includes('/imports/scenes') ||
                                   modifiedReq.url.includes('/imports/progress');
    
    let timeoutMs: number;
    if (isTiffValidationRequest) {
      timeoutMs = 300000; // ✅ 5 minutes for TIFF validation (large files can be slow)
    } else if (isSegmentationRequest) {
      timeoutMs = 180000; // 3 min for segmentation
    } else {
      timeoutMs = 30000; // 30s for other requests
    }

    return next.handle(modifiedReq).pipe(
      timeout(timeoutMs)
    );
  }
}
