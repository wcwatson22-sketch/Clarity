import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { from } from 'rxjs';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * On native iOS/Android, Angular's HttpClient uses the browser's fetch/XHR inside
 * WKWebView, which enforces CORS. The server returns Access-Control-Allow-Origin for
 * the web origin but not for capacitor://localhost, so every API call is blocked.
 *
 * This interceptor short-circuits HttpClient on native platforms and uses CapacitorHttp
 * instead. CapacitorHttp calls are made by the native URLSession (iOS) / OkHttp (Android)
 * layer — CORS headers are irrelevant because it is not a browser fetch.
 */
export const nativeHttpInterceptor: HttpInterceptorFn = (req, next) => {
  // Only activate on native Capacitor (iOS / Android)
  if (!Capacitor.isNativePlatform()) {
    return next(req);
  }

  // Build headers map from Angular HttpHeaders
  const headers: Record<string, string> = {};
  req.headers.keys().forEach(key => {
    const val = req.headers.get(key);
    if (val != null) headers[key] = val;
  });

  // Ensure JSON content-type when a body is present and not already set
  if (req.body != null && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  const promise = CapacitorHttp.request({
    method: req.method,
    url: req.urlWithParams,
    headers,
    data: req.body ?? undefined,
  }).then(response => {
    if (response.status >= 200 && response.status < 300) {
      return new HttpResponse({
        body: response.data,
        status: response.status,
        statusText: 'OK',
        url: req.url,
      });
    }
    // Throw so catchError in auth interceptor picks up 401 etc.
    throw new HttpErrorResponse({
      error: response.data,
      status: response.status,
      statusText: String(response.status),
      url: req.url,
    });
  });

  return from(promise);
};
