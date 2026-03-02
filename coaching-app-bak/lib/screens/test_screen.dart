import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import '../api/api_service.dart';
import 'result_screen.dart';

class TestScreen extends StatefulWidget {
  final String testId;
  const TestScreen({super.key, required this.testId});

  @override
  State<TestScreen> createState() => _TestScreenState();
}

class _TestScreenState extends State<TestScreen> {
  Map<String, dynamic>? _testInfo;
  List<dynamic> _questions = [];
  bool _isLoading = true;
  String? _errorMsg;

  // State for taking test
  int _currentIndex = 0;
  Map<String, String> _answers = {}; // question_id -> 'A'/'B'/'C'/'D'
  Timer? _timer;
  int _secondsRemaining = 0;

  @override
  void initState() {
    super.initState();
    _startOrFetchTest();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _startOrFetchTest() async {
    try {
      final response = await ApiService.get('/tests/${widget.testId}/start');
      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        setState(() {
          _testInfo = data['test'];
          _questions = data['questions'];
          _secondsRemaining = (_testInfo!['duration_minutes'] as int) * 60;
          _isLoading = false;
        });
        _startTimer();
      } else {
        setState(() {
          _errorMsg = data['message'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() => _secondsRemaining--);
      } else {
        _timer?.cancel();
        _submitTest(); // Auto submit
      }
    });
  }

  Future<void> _submitTest() async {
    _timer?.cancel();
    setState(() => _isLoading = true);

    try {
      // Format answers for API
      final formattedAnswers = _answers.entries
          .map((e) => {'question_id': e.key, 'selected_option': e.value})
          .toList();

      final response = await ApiService.post(
          '/tests/${widget.testId}/submit', {'answers': formattedAnswers});

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        if (!mounted) return;
        Navigator.of(context).pushReplacement(MaterialPageRoute(
            builder: (_) =>
                ResultScreen(score: data['score'], total: data['totalMarks'])));
      } else {
        setState(() {
          _errorMsg = data['message'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatTime(int seconds) {
    int minutes = seconds ~/ 60;
    int remainingSeconds = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainingSeconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_errorMsg != null)
      return Scaffold(appBar: AppBar(), body: Center(child: Text(_errorMsg!)));
    if (_questions.isEmpty)
      return Scaffold(
          appBar: AppBar(),
          body: const Center(child: Text('No questions found.')));

    final question = _questions[_currentIndex];
    final qId = question['id'];

    return Scaffold(
      appBar: AppBar(
        title: Text(_testInfo!['title']),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Text(
                _formatTime(_secondsRemaining),
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.yellow),
              ),
            ),
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Question ${_currentIndex + 1} of ${_questions.length}',
                style: const TextStyle(fontSize: 16, color: Colors.grey)),
            const SizedBox(height: 16),
            Text(question['question_text'],
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            const SizedBox(height: 32),
            ...['A', 'B', 'C', 'D'].map((opt) {
              final isSelected = _answers[qId] == opt;
              final optText = question['option_${opt.toLowerCase()}'];

              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: InkWell(
                  onTap: () => setState(() => _answers[qId] = opt),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                        color:
                            isSelected ? Colors.indigo.shade50 : Colors.white,
                        border: Border.all(
                            color: isSelected
                                ? Colors.indigo
                                : Colors.grey.shade300,
                            width: 2),
                        borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor:
                              isSelected ? Colors.indigo : Colors.grey.shade200,
                          foregroundColor:
                              isSelected ? Colors.white : Colors.black,
                          child: Text(opt),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                            child: Text(optText,
                                style: const TextStyle(fontSize: 16))),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (_currentIndex > 0)
                  ElevatedButton(
                    onPressed: () => setState(() => _currentIndex--),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.grey.shade300,
                        foregroundColor: Colors.black),
                    child: const Text('Previous'),
                  )
                else
                  const SizedBox(),
                if (_currentIndex < _questions.length - 1)
                  ElevatedButton(
                    onPressed: () => setState(() => _currentIndex++),
                    child: const Text('Next'),
                  )
                else
                  ElevatedButton(
                    onPressed: _submitTest,
                    style:
                        ElevatedButton.styleFrom(backgroundColor: Colors.green),
                    child: const Text('Submit Test'),
                  ),
              ],
            )
          ],
        ),
      ),
    );
  }
}
