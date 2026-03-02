import 'dart:convert';
import 'package:flutter/material.dart';
import '../api/api_service.dart';
import 'test_screen.dart';

class TestListScreen extends StatefulWidget {
  final String courseId;
  const TestListScreen({super.key, required this.courseId});

  @override
  State<TestListScreen> createState() => _TestListScreenState();
}

class _TestListScreenState extends State<TestListScreen> {
  List<dynamic> _tests = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchTests();
  }

  Future<void> _fetchTests() async {
    try {
      final response = await ApiService.get('/tests/course/${widget.courseId}');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _tests = data['tests'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Available Tests')),
      backgroundColor: Colors.grey.shade50,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _tests.length,
              itemBuilder: (context, index) {
                final test = _tests[index];
                return Card(
                  elevation: 2,
                  margin: const EdgeInsets.only(bottom: 16),
                  child: ListTile(
                    leading: const Icon(Icons.quiz, color: Colors.indigo),
                    title: Text(test['title'],
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle:
                        Text('Duration: ${test['duration_minutes']} mins'),
                    trailing: ElevatedButton(
                      onPressed: () {
                        Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    TestScreen(testId: test['id'])));
                      },
                      child: const Text('Start'),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
