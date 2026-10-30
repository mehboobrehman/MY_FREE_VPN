import 'dart:async';
import 'package:http/http.dart' as http;
import 'agent_logger.dart';

/// Intercepts HTTP requests and responses to automatically capture and log
/// headers, status codes, duration, and errors via [AgentLogger].
class InterceptedClient extends http.BaseClient {
  final http.Client _inner;

  InterceptedClient([http.Client? inner]) : _inner = inner ?? http.Client();

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final startTime = DateTime.now();
    final method = request.method;
    final url = request.url.toString();
    
    String? requestBody;
    if (request is http.Request) {
      requestBody = request.body;
    }

    final requestHeaders = request.headers;

    try {
      final response = await _inner.send(request);
      final duration = DateTime.now().difference(startTime).inMilliseconds;

      // Read response body stream for logging (without consuming it permanently)
      final responseBytes = await response.stream.toBytes();
      final responseBody = String.fromCharCodes(responseBytes);

      await AgentLogger.logHttp(
        method: method,
        url: url,
        statusCode: response.statusCode,
        durationMs: duration,
        requestHeaders: requestHeaders,
        requestBody: requestBody,
        responseHeaders: response.headers,
        responseBody: responseBody,
      );

      // Return new streamed response with the consumed bytes re-streamed
      return http.StreamedResponse(
        Stream.value(responseBytes),
        response.statusCode,
        contentLength: response.contentLength,
        request: response.request,
        headers: response.headers,
        isRedirect: response.isRedirect,
        reasonPhrase: response.reasonPhrase,
      );
    } catch (e) {
      final duration = DateTime.now().difference(startTime).inMilliseconds;
      await AgentLogger.logHttp(
        method: method,
        url: url,
        statusCode: 0,
        durationMs: duration,
        requestHeaders: requestHeaders,
        requestBody: requestBody,
        error: e.toString(),
      );
      rethrow;
    }
  }

  @override
  void close() {
    _inner.close();
    super.close();
  }
}
