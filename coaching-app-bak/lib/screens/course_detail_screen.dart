import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../api/api_service.dart';
import 'test_list_screen.dart';

class CourseDetailScreen extends StatefulWidget {
  final String courseId;
  const CourseDetailScreen({super.key, required this.courseId});

  @override
  State<CourseDetailScreen> createState() => _CourseDetailScreenState();
}

class _CourseDetailScreenState extends State<CourseDetailScreen> {
  Map<String, dynamic>? _course;
  bool _isLoading = true;
  bool _hasAccess = false;
  String? _errorMsg;
  late Razorpay _razorpay;

  @override
  void initState() {
    super.initState();
    _fetchCourseContent();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _fetchCourseContent() async {
    try {
      final response = await ApiService.get(
        '/courses/${widget.courseId}/content',
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _course = data['course'];
          _hasAccess = true;
          _isLoading = false;
        });
      } else if (response.statusCode == 403) {
        // Needs Purchase
        _fetchPublicCourseInfo();
      } else {
        setState(() {
          _errorMsg = jsonDecode(response.body)['message'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchPublicCourseInfo() async {
    try {
      final response = await ApiService.get('/courses');
      if (response.statusCode == 200) {
        final courses = jsonDecode(response.body)['courses'] as List;
        final course = courses.firstWhere(
          (c) => c['id'] == widget.courseId,
          orElse: () => null,
        );
        if (course != null) {
          setState(() {
            _course = course;
            _hasAccess = false;
            _isLoading = false;
          });
        }
      }
    } catch (e) {}
  }

  Future<void> _launchVideo(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Could not launch video')));
    }
  }

  Future<void> _buyCourse() async {
    setState(() => _isLoading = true);
    try {
      // 1. Create order on backend
      final orderRes = await ApiService.post('/payments/create-order', {
        'courseId': widget.courseId,
      });
      final orderData = jsonDecode(orderRes.body);

      if (orderRes.statusCode != 200) {
        throw Exception(orderData['message']);
      }

      // 2. Open Razorpay Check out
      var options = {
        'key':
            'rzp_test_YOUR_KEY_HERE', // Should ideally be fetched via API or Env
        'amount': orderData['amount'],
        'name': 'Coaching Center',
        'description': 'Course Purchase',
        'order_id': orderData['orderId'],
      };

      _razorpay.open(options);
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    try {
      final res = await ApiService.post('/payments/verify', {
        'razorpay_order_id': response.orderId,
        'razorpay_payment_id': response.paymentId,
        'razorpay_signature': response.signature,
      });

      if (res.statusCode == 200) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Payment Successful!')));
        _fetchCourseContent(); // Reload data to grant access
      } else {
        throw Exception(jsonDecode(res.body)['message']);
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
      setState(() => _isLoading = false);
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Payment Failed: ${response.message}')),
    );
    setState(() => _isLoading = false);
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('External Wallet Selected')));
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_errorMsg != null)
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(_errorMsg!)),
      );
    if (_course == null)
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Not found')),
      );

    return Scaffold(
      appBar: AppBar(title: Text(_course!['title'])),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  const Icon(Icons.school, size: 80, color: Colors.indigo),
                  const SizedBox(height: 16),
                  Text(
                    _course!['title'],
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '₹${_course!['price']}',
                    style: TextStyle(
                      fontSize: 20,
                      color: Colors.green.shade700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Description',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _course!['description'] ?? 'No description provided.',
              style: const TextStyle(fontSize: 16, height: 1.5),
            ),
            const SizedBox(height: 32),

            if (!_hasAccess)
              ElevatedButton.icon(
                icon: const Icon(Icons.shopping_cart),
                label: const Text(
                  'Buy Now',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.all(16),
                ),
                onPressed: _buyCourse,
              )
            else ...[
              ElevatedButton.icon(
                icon: const Icon(Icons.play_circle_fill),
                label: const Text(
                  'Watch Lecture Video',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                ),
                onPressed: () => _launchVideo(_course!['video_url']),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.assignment),
                label: const Text(
                  'Take Course Tests',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo,
                  foregroundColor: Colors.white,
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TestListScreen(courseId: _course!['id']),
                    ),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
