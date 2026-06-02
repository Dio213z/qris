// public_chat_page.dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'app_config.dart';  // ✅ import config

class PublicChatPage extends StatefulWidget {
  final String sessionKey;
  final String username;
  final String role;

  const PublicChatPage({
    super.key,
    required this.sessionKey,
    required this.username,
    required this.role,
  });

  @override
  State<PublicChatPage> createState() => _PublicChatPageState();
}

class _PublicChatPageState extends State<PublicChatPage> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<ChatMessage> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  int _onlineCount = 0;
  Timer? _pollingTimer;
  String? _lastMessageId;
  
  // ✅ LANGSUNG PAKAI kBaseUrl DARI APP_CONFIG
  late final String _baseUrl;

  // --- MODERN RED THEME ---
  static const Color bgDark = Color(0xFF000000);
  static const Color accentRed = Color(0xFF9E9E9E);
  static const Color darkRed = Color(0xFF212121);
  static const Color primaryWhite = Color(0xFFFFFFFF);
  static const Color softGrey = Color(0xFF9E9E9E);
  static const Color glassPrimary = Color(0x1AFFFFFF);
  static const Color glassSecondary = Color(0x0DFFFFFF);
  static const Color liveGreen = Color(0xFF22C55E);

  LinearGradient get redGradient => const LinearGradient(
        colors: [Color(0xFF1A1A1A), Color(0xFF424242)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  @override
  void initState() {
    super.initState();
    // ✅ AMBIL DARI APP_CONFIG
    _baseUrl = kBaseUrl;
    _loadMessages();
    _startPolling();
    _fetchOnlineUsers();
    _startOnlinePolling();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _onlineTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _startPolling() {
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _checkNewMessages();
    });
  }

  Timer? _onlineTimer;

  void _startOnlinePolling() {
    _onlineTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _fetchOnlineUsers();
    });
  }

  Future<void> _checkNewMessages() async {
    if (_lastMessageId == null) return;

    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/getPublicChat?key=${widget.sessionKey}&lastId=$_lastMessageId'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['valid'] == true) {
          final newMessages = (data['messages'] as List)
              .map((item) => ChatMessage.fromJson(item))
              .toList();

          if (newMessages.isNotEmpty) {
            setState(() {
              _messages.insertAll(0, newMessages);
              _lastMessageId = _messages.first.id;
            });
          }
        }
      }
    } catch (e) {
      debugPrint('Error checking new messages: $e');
    }
  }

  Future<void> _loadMessages() async {
    setState(() => _isLoading = true);

    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/getPublicChat?key=${widget.sessionKey}'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['valid'] == true) {
          setState(() {
            _messages = (data['messages'] as List)
                .map((item) => ChatMessage.fromJson(item))
                .toList();
            if (_messages.isNotEmpty) {
              _lastMessageId = _messages.first.id;
            }
          });
        }
      }
    } catch (e) {
      debugPrint('Error loading messages: $e');
    } finally {
      setState(() => _isLoading = false);
      _scrollToBottom();
    }
  }

  Future<void> _fetchOnlineUsers() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/getOnlineUsers?key=${widget.sessionKey}'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['valid'] == true) {
          setState(() {
            _onlineCount = data['count'] ?? 0;
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching online users: $e');
    }
  }

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();
    if (message.isEmpty) return;

    setState(() => _isSending = true);

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/sendPublicChat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'key': widget.sessionKey,
          'message': message,
        }),
      );

      final data = jsonDecode(response.body);
      if (data['valid'] == true) {
        _messageController.clear();
        final newMessage = ChatMessage.fromJson(data['message']);
        setState(() {
          _messages.insert(0, newMessage);
          _lastMessageId = newMessage.id;
        });
        _scrollToBottom();
      } else {
        _showSnackBar(data['message'] ?? 'Gagal mengirim pesan', isError: true);
      }
    } catch (e) {
      debugPrint('Error sending message: $e');
      _showSnackBar('Gagal mengirim pesan', isError: true);
    } finally {
      setState(() => _isSending = false);
    }
  }

  Future<void> _deleteMessage(String messageId, String messageUsername) async {
    final canDelete = widget.role == 'owner' || widget.username == messageUsername;

    if (!canDelete) {
      _showSnackBar('Tidak bisa menghapus pesan orang lain', isError: true);
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: TweenAnimationBuilder(
          duration: const Duration(milliseconds: 300),
          tween: Tween<double>(begin: 0, end: 1),
          builder: (context, double scale, child) {
            return Transform.scale(scale: scale, child: child);
          },
          child: Container(
            margin: const EdgeInsets.all(20),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [bgDark, bgDark.withOpacity(0.95)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(32),
              border: Border.all(color: accentRed.withOpacity(0.3), width: 1.5),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.withOpacity(0.1),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.grey.withOpacity(0.3)),
                  ),
                  child: const Icon(Icons.warning_amber_rounded,
                      color: Colors.white70, size: 32),
                ),
                const SizedBox(height: 20),
                const Text(
                  "Hapus Pesan",
                  style: TextStyle(
                    color: primaryWhite,
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  "Yakin ingin menghapus pesan ini?",
                  style: TextStyle(color: softGrey, fontSize: 14),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => Navigator.pop(context, false),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.05),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withOpacity(0.1)),
                          ),
                          child: const Center(
                            child: Text(
                              "BATAL",
                              style: TextStyle(color: softGrey, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => Navigator.pop(context, true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.grey.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.grey.withOpacity(0.3)),
                          ),
                          child: const Center(
                            child: Text(
                              "HAPUS",
                              style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (confirm != true) return;

    try {
      final response = await http.delete(
        Uri.parse('$_baseUrl/deletePublicChat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'key': widget.sessionKey,
          'messageId': messageId,
        }),
      );

      final data = jsonDecode(response.body);
      if (data['valid'] == true) {
        setState(() {
          _messages.removeWhere((m) => m.id == messageId);
        });
        _showSnackBar('Pesan berhasil dihapus', isError: false);
      } else {
        _showSnackBar(data['message'] ?? 'Gagal menghapus pesan', isError: true);
      }
    } catch (e) {
      debugPrint('Error deleting message: $e');
      _showSnackBar('Gagal menghapus pesan', isError: true);
    }
  }

  void _showSnackBar(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : Icons.check_circle_outline,
              color: primaryWhite,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                msg,
                style: const TextStyle(color: primaryWhite, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? Colors.grey.withOpacity(0.9) : accentRed.withOpacity(0.9),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Color _getRoleColor(String role) {
    switch (role.toLowerCase()) {
      case 'owner':
        return accentRed;
      case 'admin':
        return Colors.orange;
      case 'vip':
        return Colors.grey;
      default:
        return softGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        title: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            gradient: redGradient,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: accentRed.withOpacity(0.3),
                blurRadius: 10,
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.public_rounded, color: primaryWhite, size: 18),
              const SizedBox(width: 8),
              const Text(
                "PUBLIC CHAT",
                style: TextStyle(
                  color: primaryWhite,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: glassSecondary,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: primaryWhite.withOpacity(0.08)),
            ),
            child: const Icon(Icons.arrow_back_ios_new, color: accentRed, size: 18),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: liveGreen.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: liveGreen.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: liveGreen,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: liveGreen, blurRadius: 5)],
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '$_onlineCount Online',
                  style: TextStyle(
                    color: liveGreen,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.5,
            colors: [accentRed.withOpacity(0.15), bgDark, bgDark],
            stops: const [0.0, 0.4, 1.0],
          ),
        ),
        // ✅ LANGSUNG CHILD COLUMN (TANPA _GridPainter di sini)
        child: Column(
          children: [
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: accentRed, strokeWidth: 3),
                    )
                  : _messages.isEmpty
                      ? Center(
                          child: TweenAnimationBuilder(
                            duration: const Duration(milliseconds: 600),
                            tween: Tween<double>(begin: 0, end: 1),
                            builder: (context, double value, child) {
                              return Opacity(
                                opacity: value,
                                child: Transform.translate(
                                  offset: Offset(0, 20 * (1 - value)),
                                  child: child,
                                ),
                              );
                            },
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(32),
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        accentRed.withOpacity(0.1),
                                        darkRed.withOpacity(0.1)
                                      ],
                                    ),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: accentRed.withOpacity(0.2)),
                                  ),
                                  child: const Icon(Icons.chat_bubble_outline,
                                      size: 64, color: accentRed),
                                ),
                                const SizedBox(height: 20),
                                Text(
                                  'Belum ada pesan',
                                  style: TextStyle(color: softGrey, fontSize: 14),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Jadilah yang pertama mengirim pesan',
                                  style: TextStyle(color: softGrey.withOpacity(0.7), fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          reverse: true,
                          padding: const EdgeInsets.all(12),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final msg = _messages[index];
                            final isMe = msg.username == widget.username;
                            return GestureDetector(
                              onLongPress: () => _deleteMessage(msg.id, msg.username),
                              child: TweenAnimationBuilder(
                                duration: Duration(milliseconds: 200 + (index * 20)),
                                tween: Tween<double>(begin: 0, end: 1),
                                builder: (context, double value, child) {
                                  return Opacity(
                                    opacity: value,
                                    child: Transform.translate(
                                      offset: Offset(0, 20 * (1 - value)),
                                      child: child,
                                    ),
                                  );
                                },
                                child: _buildMessageBubble(msg, isMe),
                              ),
                            );
                          },
                        ),
            ),
            // Input bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: glassPrimary,
                border: Border(
                  top: BorderSide(color: primaryWhite.withOpacity(0.08)),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: glassSecondary,
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: primaryWhite.withOpacity(0.1)),
                      ),
                      child: TextField(
                        controller: _messageController,
                        style: const TextStyle(color: primaryWhite),
                        maxLines: null,
                        decoration: InputDecoration(
                          hintText: 'Tulis pesan...',
                          hintStyle: TextStyle(color: softGrey.withOpacity(0.5)),
                          border: InputBorder.none,
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _isSending ? null : _sendMessage,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        gradient: redGradient,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: accentRed.withOpacity(0.4),
                            blurRadius: 12,
                          ),
                        ],
                      ),
                      child: _isSending
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: primaryWhite,
                              ),
                            )
                          : const Icon(Icons.send_rounded,
                              color: primaryWhite, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg, bool isMe) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isMe) ...[
            Container(
              width: 42,
              height: 42,
              margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(
                gradient: redGradient,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: accentRed.withOpacity(0.3),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  msg.username.isNotEmpty ? msg.username[0].toUpperCase() : '?',
                  style: const TextStyle(
                    color: primaryWhite,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                gradient: isMe
                    ? redGradient
                    : LinearGradient(
                        colors: [glassPrimary, glassSecondary],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                borderRadius: BorderRadius.circular(20).copyWith(
                  bottomRight: isMe ? const Radius.circular(6) : const Radius.circular(20),
                  bottomLeft: isMe ? const Radius.circular(20) : const Radius.circular(6),
                ),
                border: isMe
                    ? null
                    : Border.all(color: primaryWhite.withOpacity(0.08)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!isMe)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          Text(
                            msg.username,
                            style: TextStyle(
                              color: _getRoleColor(msg.role),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (msg.role == 'owner') ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: accentRed.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: accentRed.withOpacity(0.3)),
                              ),
                              child: const Text(
                                "OWNER",
                                style: TextStyle(
                                  color: accentRed,
                                  fontSize: 8,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  Text(
                    msg.message,
                    style: const TextStyle(color: primaryWhite, fontSize: 13),
                    softWrap: true,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    msg.formattedTime,
                    style: TextStyle(
                      color: primaryWhite.withOpacity(0.4),
                      fontSize: 9,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Model ChatMessage
class ChatMessage {
  final String id;
  final String username;
  final String role;
  final String message;
  final String timestamp;
  final String formattedTime;

  ChatMessage({
    required this.id,
    required this.username,
    required this.role,
    required this.message,
    required this.timestamp,
    required this.formattedTime,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] ?? '',
      username: json['username'] ?? '',
      role: json['role'] ?? 'member',
      message: json['message'] ?? '',
      timestamp: json['timestamp'] ?? DateTime.now().toIso8601String(),
      formattedTime: json['formattedTime'] ?? '',
    );
  }
}