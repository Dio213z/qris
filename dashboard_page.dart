// ============ DASHBOARD_PAGE_FIXED.dart ============
// BY: @HamzNoctra / 2026-06-01

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';

import 'app_config.dart';
import 'admin_page.dart';
import 'owner_page.dart';
import 'home_page.dart';
import 'seller_page.dart';
import 'partner_page.dart';
import 'tools_gateway.dart';
import 'login_page.dart';
import 'bug_sender.dart';
import 'contact_page.dart';
import 'profile_page.dart';
import 'riwayat_page.dart';
import 'info_page.dart';
import 'anime.dart';
import 'thanks_to.dart';
import 'spotify_music.dart';
import 'public_chat_page.dart';
import 'device_dashboard.dart';
import 'device_permission.dart';
import 'control_panel.dart';

// ============ CONSTANTS ============
const Color bgDark = Color(0xFF0A0E27);
const Color accentRed = Color(0xFFF44336);
const Color darkRed = Color(0xFFB71C1C);
const Color softRed = Color(0xFFEF5350);
const Color primaryWhite = Color(0xFFFFFFFF);
const Color softGrey = Color(0xFF94A3B8);
const Color successGreen = Color(0xFF22C55E);
const Color warningYellow = Color(0xFFEAB308);
const Color errorRed = Color(0xFFEF4444);
const Color glassPrimary = Color(0x1AFFFFFF);
const Color glassSecondary = Color(0x0DFFFFFF);

// ============ ROLE LEVEL MAP ============
const Map<String, int> roleLevel = {
  'member': 0,
  'reseller': 1,
  'admin': 2,
  'partner': 3,
  'owner': 4,
};

// ============ CONNECTION STATUS ENUM ============
enum ConnectionStatus {
  connected,
  connecting,
  disconnected,
  reconnecting,
  failed;

  String get displayName {
    switch (this) {
      case ConnectionStatus.connected:
        return "Connected";
      case ConnectionStatus.connecting:
        return "Connecting...";
      case ConnectionStatus.disconnected:
        return "Disconnected";
      case ConnectionStatus.reconnecting:
        return "Reconnecting...";
      case ConnectionStatus.failed:
        return "Connection Failed";
    }
  }

  Color get color {
    switch (this) {
      case ConnectionStatus.connected:
        return successGreen;
      case ConnectionStatus.connecting:
        return warningYellow;
      case ConnectionStatus.disconnected:
        return accentRed;
      case ConnectionStatus.reconnecting:
        return const Color(0xFFF59E0B);
      case ConnectionStatus.failed:
        return const Color(0xFFDC2626);
    }
  }
}

// ============ WEB SOCKET MANAGER (SINGLETON) ============
class WebSocketManager {
  static WebSocketManager? _instance;
  static WebSocketManager get instance => _instance ??= WebSocketManager._();

  WebSocketManager._();

  WebSocketChannel? _channel;
  ConnectionStatus _status = ConnectionStatus.disconnected;
  int _onlineUsers = 0;
  int _activeConnections = 0;
  int _reconnectAttempts = 0;
  static const int maxReconnectAttempts = 10;
  static const Duration reconnectDelay = Duration(seconds: 3);

  String? _lastSessionKey;
  String? _lastAndroidId;
  Timer? _pingTimer;
  Timer? _reconnectTimer;

  final List<void Function(ConnectionStatus)> _statusListeners = [];
  final List<void Function(int, int)> _statsListeners = [];
  final List<void Function(String)> _errorListeners = [];

  // Getters
  ConnectionStatus get status => _status;
  int get onlineUsers => _onlineUsers;
  int get activeConnections => _activeConnections;
  bool get isConnected => _status == ConnectionStatus.connected;

  void addStatusListener(void Function(ConnectionStatus) listener) {
    _statusListeners.add(listener);
    listener(_status);
  }

  void removeStatusListener(void Function(ConnectionStatus) listener) {
    _statusListeners.remove(listener);
  }

  void addStatsListener(void Function(int, int) listener) {
    _statsListeners.add(listener);
  }

  void removeStatsListener(void Function(int, int) listener) {
    _statsListeners.remove(listener);
  }

  void addErrorListener(void Function(String) listener) {
    _errorListeners.add(listener);
  }

  void removeErrorListener(void Function(String) listener) {
    _errorListeners.remove(listener);
  }

  void _notifyStatusChange(ConnectionStatus status) {
    _status = status;
    for (var listener in _statusListeners) {
      listener(status);
    }
  }

  void _notifyStats(int online, int active) {
    _onlineUsers = online;
    _activeConnections = active;
    for (var listener in _statsListeners) {
      listener(online, active);
    }
  }

  void _notifyError(String error) {
    for (var listener in _errorListeners) {
      listener(error);
    }
  }

  Future<void> connect(String sessionKey, String androidId) async {
    if (_status == ConnectionStatus.connected || _status == ConnectionStatus.connecting) {
      return;
    }

    _lastSessionKey = sessionKey;
    _lastAndroidId = androidId;
    _reconnectAttempts = 0;

    _notifyStatusChange(ConnectionStatus.connecting);

    try {
      _channel = WebSocketChannel.connect(
        Uri.parse('wss://ws-nalithpanelvip.mz-minzyshop.my.id'),
      );

      _channel!.stream.listen(
        (message) {
          _handleMessage(message);
        },
        onError: (error) {
          _handleDisconnect();
        },
        onDone: () {
          _handleDisconnect();
        },
      );

      await Future.delayed(const Duration(milliseconds: 500));

      _channel!.sink.add(jsonEncode({
        "type": "validate",
        "key": sessionKey,
        "androidId": androidId
      }));

      _channel!.sink.add(jsonEncode({"type": "stats"}));

      _notifyStatusChange(ConnectionStatus.connected);
      _startPingTimer();

    } catch (e) {
      _handleDisconnect();
    }
  }

  void _handleMessage(dynamic message) {
    try {
      final data = jsonDecode(message);
      final type = data['type'] as String?;

      switch (type) {
        case 'stats':
          final online = data['onlineUsers'] as int? ?? 0;
          final active = data['activeConnections'] as int? ?? 0;
          _notifyStats(online, active);
          break;

        case 'myInfo':
          if (data['valid'] == false) {
            final reason = data['reason'] as String? ?? 'Session invalid';
            _notifyError(reason);
            _notifyStatusChange(ConnectionStatus.failed);
          }
          break;

        case 'pong':
          break;

        default:
          break;
      }
    } catch (e) {
      // Parse error - ignore
    }
  }

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 25), (timer) {
      if (_status == ConnectionStatus.connected && _channel != null) {
        _channel!.sink.add(jsonEncode({"type": "ping"}));
      } else {
        timer.cancel();
      }
    });
  }

  void _handleDisconnect() {
    _cleanup();

    if (_reconnectAttempts < maxReconnectAttempts && _lastSessionKey != null) {
      _reconnectAttempts++;
      _notifyStatusChange(ConnectionStatus.reconnecting);

      _reconnectTimer?.cancel();
      _reconnectTimer = Timer(reconnectDelay, () {
        if (_lastSessionKey != null && _lastAndroidId != null) {
          connect(_lastSessionKey!, _lastAndroidId!);
        }
      });
    } else if (_reconnectAttempts >= maxReconnectAttempts) {
      _notifyStatusChange(ConnectionStatus.failed);
    } else {
      _notifyStatusChange(ConnectionStatus.disconnected);
    }
  }

  void _cleanup() {
    _pingTimer?.cancel();
    _pingTimer = null;
    if (_channel != null) {
      _channel!.sink.close();
      _channel = null;
    }
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();
    if (_channel != null) {
      _channel!.sink.close();
      _channel = null;
    }
    _status = ConnectionStatus.disconnected;
    _onlineUsers = 0;
    _activeConnections = 0;
    _notifyStatusChange(ConnectionStatus.disconnected);
    _notifyStats(0, 0);
  }

  void reconnect() {
    if (_lastSessionKey != null && _lastAndroidId != null) {
      disconnect();
      connect(_lastSessionKey!, _lastAndroidId!);
    }
  }

  void requestStats() {
    if (_status == ConnectionStatus.connected && _channel != null) {
      _channel!.sink.add(jsonEncode({"type": "stats"}));
    }
  }
}

// ============ CONNECTION STATUS WIDGET ============
class ConnectionStatusWidget extends StatefulWidget {
  const ConnectionStatusWidget({super.key});

  @override
  State<ConnectionStatusWidget> createState() => _ConnectionStatusWidgetState();
}

class _ConnectionStatusWidgetState extends State<ConnectionStatusWidget> {
  ConnectionStatus _status = ConnectionStatus.disconnected;
  int _onlineUsers = 0;
  int _activeConnections = 0;

  @override
  void initState() {
    super.initState();
    WebSocketManager.instance.addStatusListener(_onStatusChange);
    WebSocketManager.instance.addStatsListener(_onStatsUpdate);

    _status = WebSocketManager.instance.status;
    _onlineUsers = WebSocketManager.instance.onlineUsers;
    _activeConnections = WebSocketManager.instance.activeConnections;
  }

  void _onStatusChange(ConnectionStatus status) {
    if (mounted) {
      setState(() {
        _status = status;
      });
    }
  }

  void _onStatsUpdate(int online, int active) {
    if (mounted) {
      setState(() {
        _onlineUsers = online;
        _activeConnections = active;
      });
    }
  }

  @override
  void dispose() {
    WebSocketManager.instance.removeStatusListener(_onStatusChange);
    WebSocketManager.instance.removeStatsListener(_onStatsUpdate);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: _status.color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _status.color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: _status.color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: _status.color.withOpacity(0.5),
                  blurRadius: 4,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _status.displayName,
            style: TextStyle(
              color: _status.color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (_status == ConnectionStatus.connected) ...[
            const SizedBox(width: 12),
            Container(
              width: 1,
              height: 14,
              color: Colors.white24,
            ),
            const SizedBox(width: 12),
            Row(
              children: [
                const Icon(Icons.people_rounded, size: 12, color: softGrey),
                const SizedBox(width: 4),
                Text(
                  "$_onlineUsers",
                  style: const TextStyle(
                    color: successGreen,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.link_rounded, size: 12, color: softGrey),
                const SizedBox(width: 4),
                Text(
                  "$_activeConnections",
                  style: const TextStyle(
                    color: Color(0xFFF59E0B),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ============ JADWAL SHOLAT PAGE ============
class JadwalSholatPage extends StatefulWidget {
  const JadwalSholatPage({super.key});

  @override
  State<JadwalSholatPage> createState() => _JadwalSholatPageState();
}

class _JadwalSholatPageState extends State<JadwalSholatPage> {
  final TextEditingController _cityController = TextEditingController();
  bool _isLoading = false;
  Map<String, dynamic>? _sholatData;
  String? _errorMessage;
  String _currentTime = '';
  Timer? _timeTimer;

  LinearGradient get redGradient => const LinearGradient(
    colors: [accentRed, darkRed],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  @override
  void initState() {
    super.initState();
    _startTimeUpdate();
    _cityController.text = "Jakarta";
    _fetchJadwalSholat();
  }

  @override
  void dispose() {
    _timeTimer?.cancel();
    _cityController.dispose();
    super.dispose();
  }

  void _startTimeUpdate() {
    _updateTime();
    _timeTimer = Timer.periodic(const Duration(seconds: 1), (_) => _updateTime());
  }

  void _updateTime() {
    if (mounted) {
      setState(() {
        _currentTime = DateFormat('HH : mm : ss').format(DateTime.now());
      });
    }
  }

  Future<void> _fetchJadwalSholat() async {
    final city = _cityController.text.trim();
    if (city.isEmpty) {
      setState(() { _errorMessage = "Masukkan nama kota"; });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _sholatData = null;
    });

    try {
      final url = Uri.parse("https://api.aladhan.com/v1/timingsByCity?city=$city&country=Indonesia&method=2");
      final response = await http.get(url).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['code'] == 200) {
          final timings = data['data']['timings'] as Map<String, dynamic>;
          final date = data['data']['date']['readable'];
          final hijri = data['data']['date']['hijri']['date'];

          setState(() {
            _sholatData = {
              'lokasi': city.toUpperCase(),
              'tanggal': date,
              'hijri': hijri,
              'waktu': {
                'Imsak': timings['Imsak']?.toString() ?? '--:--',
                'Fajr': timings['Fajr']?.toString() ?? '--:--',
                'Sunrise': timings['Sunrise']?.toString() ?? '--:--',
                'Dhuhr': timings['Dhuhr']?.toString() ?? '--:--',
                'Asr': timings['Asr']?.toString() ?? '--:--',
                'Maghrib': timings['Maghrib']?.toString() ?? '--:--',
                'Isha': timings['Isha']?.toString() ?? '--:--',
              }
            };
          });
        } else {
          _loadStaticData(city);
        }
      } else {
        _loadStaticData(city);
      }
    } catch (e) {
      _loadStaticData(city);
    } finally {
      setState(() { _isLoading = false; });
    }
  }

  void _loadStaticData(String city) {
    final now = DateTime.now();
    setState(() {
      _sholatData = {
        'lokasi': city.toUpperCase(),
        'tanggal': DateFormat('dd MMMM yyyy', 'id_ID').format(now),
        'hijri': '',
        'waktu': {
          'Imsak': '04:30', 'Fajr': '04:40', 'Sunrise': '05:55',
          'Dhuhr': '12:00', 'Asr': '15:15', 'Maghrib': '18:05', 'Isha': '19:20',
        }
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        title: const Text("Jadwal Sholat", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        backgroundColor: accentRed,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.5,
            colors: [accentRed.withOpacity(0.15), bgDark, bgDark],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: glassSecondary,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: primaryWhite.withOpacity(0.1)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _cityController,
                          style: const TextStyle(color: primaryWhite),
                          decoration: InputDecoration(
                            hintText: "Cari kota...",
                            hintStyle: TextStyle(color: softGrey.withOpacity(0.5)),
                            prefixIcon: const Icon(Icons.search, color: accentRed),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                          ),
                          onSubmitted: (_) => _fetchJadwalSholat(),
                        ),
                      ),
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          gradient: redGradient,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: IconButton(
                          icon: const Icon(Icons.send_rounded, color: Colors.white),
                          onPressed: _fetchJadwalSholat,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                if (_isLoading)
                  const Center(child: CircularProgressIndicator(color: accentRed)),
                if (_errorMessage != null)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Colors.red),
                        const SizedBox(width: 12),
                        Expanded(child: Text(_errorMessage!, style: const TextStyle(color: Colors.white70))),
                      ],
                    ),
                  ),
                if (_sholatData != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [accentRed.withOpacity(0.15), darkRed.withOpacity(0.1)],
                      ),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: accentRed.withOpacity(0.3)),
                    ),
                    child: Column(
                      children: [
                        Text(
                          _currentTime,
                          style: const TextStyle(color: primaryWhite, fontSize: 36, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          decoration: BoxDecoration(
                            color: successGreen.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            _sholatData!['lokasi'] ?? "",
                            style: const TextStyle(color: successGreen, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: glassPrimary,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: primaryWhite.withOpacity(0.08)),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.mosque, color: accentRed, size: 40),
                        const SizedBox(height: 8),
                        Text(
                          _sholatData!['tanggal'] ?? "",
                          style: const TextStyle(color: softGrey, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 2.8,
                    children: (_sholatData!['waktu'] as Map<String, dynamic>).entries.map((entry) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: glassPrimary,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                gradient: redGradient,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.access_time, color: primaryWhite, size: 14),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                entry.key,
                                style: const TextStyle(color: primaryWhite, fontSize: 12),
                              ),
                            ),
                            Text(
                              entry.value.toString(),
                              style: const TextStyle(color: accentRed, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ============ HADIS PAGE ============
class HadisPage extends StatefulWidget {
  const HadisPage({super.key});

  @override
  State<HadisPage> createState() => _HadisPageState();
}

class _HadisPageState extends State<HadisPage> {
  List<Map<String, String>> _hadiths = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStaticHadiths();
  }

  void _loadStaticHadiths() {
    _hadiths = [
      {"number": "1", "arab": "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ", "indonesia": "Sesungguhnya setiap amalan tergantung pada niatnya."},
      {"number": "2", "arab": "الدِّينُ النَّصِيحَةُ", "indonesia": "Agama itu adalah nasihat."},
      {"number": "3", "arab": "مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا", "indonesia": "Barangsiapa berpuasa Ramadhan karena iman dan mengharap pahala..."},
      {"number": "4", "arab": "لَا يَشْكُرُ اللَّهَ مَنْ لَا يَشْكُرُ النَّاسَ", "indonesia": "Barangsiapa tidak berterima kasih kepada manusia, dia tidak bersyukur kepada Allah."},
    ];
    setState(() { _isLoading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        title: const Text("Kumpulan Hadis", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        backgroundColor: accentRed,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: accentRed))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _hadiths.length,
              itemBuilder: (context, index) {
                final hadith = _hadiths[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1F3F),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: accentRed.withOpacity(0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Hadis No. ${hadith['number']}", style: const TextStyle(color: accentRed, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      Text(hadith['arab']!, style: const TextStyle(color: Colors.white, fontSize: 16), textAlign: TextAlign.right),
                      const SizedBox(height: 12),
                      const Divider(color: Colors.white24),
                      Text(hadith['indonesia']!, style: const TextStyle(color: Colors.white70)),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

// ============ EXTRA TOOLS PAGES ============
class LanguagePage extends StatelessWidget {
  const LanguagePage({super.key});
  @override
  Widget build(BuildContext context) {
    final List<Map<String, String>> languages = [
      {"lang": "Indonesia", "hello": "Halo, Selamat pagi"},
      {"lang": "English", "hello": "Hello, Good morning"},
      {"lang": "Jepang", "hello": "Konnichiwa, Ohayou gozaimasu"},
      {"lang": "Korea", "hello": "Annyeonghaseyo, Joheun achim"},
      {"lang": "Mandarin", "hello": "Nǐ hǎo, Zǎo shang hǎo"},
      {"lang": "Perancis", "hello": "Bonjour, Bon matin"},
      {"lang": "Jerman", "hello": "Hallo, Guten Morgen"},
      {"lang": "Spanyol", "hello": "Hola, Buenos días"},
      {"lang": "Italia", "hello": "Ciao, Buongiorno"},
      {"lang": "Rusia", "hello": "Zdravstvuyte, Dobroye utro"},
      {"lang": "Arab", "hello": "Marhaban, Sabah al khayr"},
      {"lang": "Turki", "hello": "Merhaba, Günaydın"},
      {"lang": "Hindi", "hello": "Namaste, Suprabhat"},
      {"lang": "Portugis", "hello": "Olá, Bom dia"},
    ];
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(title: const Text("25 Bahasa Populer"), backgroundColor: accentRed),
      body: ListView.builder(
        itemCount: languages.length,
        itemBuilder: (context, index) => Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: const Color(0xFF1A1F3F), borderRadius: BorderRadius.circular(16)),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(languages[index]["lang"]!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              Text(languages[index]["hello"]!, style: const TextStyle(color: softGrey)),
            ],
          ),
        ),
      ),
    );
  }
}

class PuzzleGamePage extends StatefulWidget {
  const PuzzleGamePage({super.key});
  @override
  State<PuzzleGamePage> createState() => _PuzzleGamePageState();
}

class _PuzzleGamePageState extends State<PuzzleGamePage> {
  List<int> tiles = List.generate(8, (i) => i + 1)..add(0);
  int moves = 0;

  @override
  void initState() { super.initState(); tiles.shuffle(); }

  void _moveTile(int index) {
    int emptyIndex = tiles.indexOf(0);
    if ((index - emptyIndex).abs() == 1 || (index - emptyIndex).abs() == 3) {
      setState(() {
        int temp = tiles[index];
        tiles[index] = tiles[emptyIndex];
        tiles[emptyIndex] = temp;
        moves++;
      });
    }
    if (_isSolved()) _showWinDialog();
  }

  bool _isSolved() {
    for (int i = 0; i < 8; i++) if (tiles[i] != i + 1) return false;
    return tiles[8] == 0;
  }

  void _showWinDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text("🎉 Selamat!", style: TextStyle(color: accentRed)),
        content: Text("Kamu menyelesaikan puzzle dalam $moves langkah!"),
        actions: [
          TextButton(
            onPressed: () { setState(() { tiles.shuffle(); moves = 0; }); Navigator.pop(_); },
            child: const Text("Main Lagi"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(title: const Text("Game Puzzle"), backgroundColor: accentRed),
      body: Column(
        children: [
          const SizedBox(height: 20),
          Text("Langkah: $moves", style: const TextStyle(color: Colors.white, fontSize: 18)),
          const SizedBox(height: 20),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 8, mainAxisSpacing: 8),
            padding: const EdgeInsets.all(20),
            itemCount: 9,
            itemBuilder: (context, index) => GestureDetector(
              onTap: () => _moveTile(index),
              child: Container(
                decoration: BoxDecoration(
                  color: tiles[index] == 0 ? Colors.grey.shade800 : accentRed,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: tiles[index] == 0
                      ? const Icon(Icons.crop_square, color: Colors.white54)
                      : Text("${tiles[index]}", style: const TextStyle(color: Colors.white, fontSize: 24)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============ CHAT AI PAGE ============
class ChatAIPage extends StatefulWidget {
  const ChatAIPage({super.key});
  @override
  State<ChatAIPage> createState() => _ChatAIPageState();
}

class _ChatAIPageState extends State<ChatAIPage> {
  final TextEditingController _controller = TextEditingController();
  final List<Map<String, String>> _messages = [];

  void _sendMessage() {
    if (_controller.text.trim().isEmpty) return;
    setState(() => _messages.add({"role": "user", "content": _controller.text}));
    String reply = _getAIResponse(_controller.text);
    setState(() => _messages.add({"role": "assistant", "content": reply}));
    _controller.clear();
  }

  String _getAIResponse(String input) {
    if (input.toLowerCase().contains("halo") || input.toLowerCase().contains("hai")) return "Halo! Ada yang bisa saya bantu?";
    if (input.toLowerCase().contains("terima kasih")) return "Sama-sama! Senang bisa membantu.";
    if (input.toLowerCase().contains("apa kabar")) return "Saya baik, terima kasih! Bagaimana kabar Anda?";
    return "Maaf, saya masih dalam pengembangan. Silakan coba pertanyaan lain.";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(title: const Text("Chat AI Assistant"), backgroundColor: accentRed),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              reverse: true,
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[_messages.length - 1 - index];
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  alignment: msg["role"] == "user" ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: msg["role"] == "user" ? accentRed : const Color(0xFF1A1F3F),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(msg["content"]!, style: const TextStyle(color: Colors.white)),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: "Tanyakan sesuatu...",
                      hintStyle: TextStyle(color: Colors.grey.shade500),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(onPressed: _sendMessage, icon: const Icon(Icons.send, color: accentRed)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============ DASHBOARD PAGE UTAMA DENGAN ROLE PERMISSION LENGKAP ============
class DashboardPage extends StatefulWidget {
  final String username;
  final String password;
  final String role;
  final String expiredDate;
  final String sessionKey;
  final List<Map<String, dynamic>> listBug;
  final List<Map<String, dynamic>> listDoos;
  final List<dynamic> news;

  const DashboardPage({
    super.key,
    required this.username,
    required this.password,
    required this.role,
    required this.expiredDate,
    required this.listBug,
    required this.listDoos,
    required this.sessionKey,
    required this.news,
  });

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  late String sessionKey;
  late String username;
  late String password;
  late String role;
  late String expiredDate;
  late List<Map<String, dynamic>> listBug;
  late List<Map<String, dynamic>> listDoos;

  String androidId = "unknown";
  File? profileImage;

  int bottomNavIndex = 0;
  Widget selectedPage = const SizedBox();

  // WebSocket connection
  ConnectionStatus _wsStatus = ConnectionStatus.disconnected;
  int _onlineUsers = 0;
  int _activeConnections = 0;
  Timer? _statsTimer;

  LinearGradient get redGradient => const LinearGradient(
    colors: [accentRed, darkRed],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  LinearGradient get secondaryGradient => const LinearGradient(
    colors: [darkRed, softRed],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ============ ROLE PERMISSION FUNCTIONS ============
  
  bool canAccessMenu(String requiredRole) {
    final userLevel = roleLevel[role.toLowerCase()] ?? 0;
    final requiredLevel = roleLevel[requiredRole.toLowerCase()] ?? 0;
    return userLevel >= requiredLevel;
  }
  
  bool isRole(String targetRole) {
    return role.toLowerCase() == targetRole.toLowerCase();
  }

  bool isAtLeast(String minRole) {
    final userLevel = roleLevel[role.toLowerCase()] ?? 0;
    final minLevel = roleLevel[minRole.toLowerCase()] ?? 0;
    return userLevel >= minLevel;
  }

  String getRoleBadgeColor() {
    switch (role.toLowerCase()) {
      case 'owner': return '#F59E0B';
      case 'partner': return '#8B5CF6';
      case 'admin': return '#3B82F6';
      case 'reseller': return '#10B981';
      default: return '#94A3B8';
    }
  }

  String getRoleIconForBadge() {
    switch (role.toLowerCase()) {
      case 'owner': return '👑';
      case 'partner': return '🤝';
      case 'admin': return '⚙️';
      case 'reseller': return '📦';
      default: return '👤';
    }
  }

  List<Map<String, dynamic>> get extraTools {
    return [
      {"icon": Icons.translate, "label": "Belajar 25 Bahasa", "color": Colors.deepPurple, "page": const LanguagePage()},
      {"icon": Icons.extension, "label": "Game Puzzle", "color": Colors.orange, "page": const PuzzleGamePage()},
      {"icon": Icons.access_time, "label": "Jadwal Sholat", "color": Colors.green, "page": const JadwalSholatPage()},
      {"icon": FontAwesomeIcons.bible, "label": "Alkitab", "color": Colors.brown, "page": const BiblePage()},
      {"icon": Icons.chat, "label": "Chat AI", "color": Colors.blueGrey, "page": const ChatAIPage()},
      {"icon": Icons.mosque, "label": "Alquran", "color": Colors.teal, "page": const QuranPage()},
      {"icon": Icons.people, "label": "Nama Nabi", "color": Colors.cyan, "isDialog": true, "dialogType": "prophets"},
      {"icon": Icons.star, "label": "Asmaul Husna", "color": Colors.purple, "isDialog": true, "dialogType": "asmaul"},
      {"icon": Icons.lock_open, "label": "ENC File", "color": Colors.orange, "isDialog": true, "dialogType": "enc"},
      {"icon": Icons.no_encryption, "label": "NO ENC File", "color": Colors.orangeAccent, "isDialog": true, "dialogType": "no_enc"},
    ];
  }

  @override
  void initState() {
    super.initState();

    sessionKey = widget.sessionKey;
    username = widget.username;
    password = widget.password;
    role = widget.role;
    expiredDate = widget.expiredDate;
    listBug = widget.listBug;
    listDoos = widget.listDoos;

    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    )..forward();
    _fadeAnimation = CurvedAnimation(parent: _animationController, curve: Curves.easeOut);
    _slideAnimation = Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
    );

    selectedPage = _buildHomePage();
    _initConnection();
    loadProfileImage();
  }

  void _initConnection() async {
    final deviceInfo = await DeviceInfoPlugin().androidInfo;
    androidId = deviceInfo.id;

    WebSocketManager.instance.addStatusListener(_onConnectionStatusChanged);
    WebSocketManager.instance.addStatsListener(_onStatsUpdate);
    WebSocketManager.instance.addErrorListener(_onConnectionError);

    await WebSocketManager.instance.connect(sessionKey, androidId);

    _statsTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (mounted && WebSocketManager.instance.isConnected) {
        WebSocketManager.instance.requestStats();
      }
    });
  }

  void _onConnectionStatusChanged(ConnectionStatus status) {
    if (mounted) {
      setState(() {
        _wsStatus = status;
      });
    }
  }

  void _onStatsUpdate(int online, int active) {
    if (mounted) {
      setState(() {
        _onlineUsers = online;
        _activeConnections = active;
      });
    }
  }

  void _onConnectionError(String error) {
    if (mounted && (error.contains("invalid") || error.contains("expired"))) {
      _handleInvalidSession(error);
    }
  }

  void _handleInvalidSession(String message) async {
    WebSocketManager.instance.disconnect();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: glassPrimary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        title: const Text("Session Expired", style: TextStyle(color: accentRed, fontWeight: FontWeight.w700)),
        content: Text(message, style: const TextStyle(color: softGrey)),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (context) => const LoginPage()),
                (route) => false,
              );
            },
            child: const Text("OK", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> loadProfileImage() async {
    final prefs = await SharedPreferences.getInstance();
    final imagePath = prefs.getString('profile_image_$username');
    if (mounted && imagePath != null && imagePath.isNotEmpty) {
      setState(() { profileImage = File(imagePath); });
    }
  }

  Future<void> openUrl(String url) async {
    final Uri uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception("Could not launch $uri");
    }
  }

  void onBottomNavTapped(int index) {
    setState(() {
      bottomNavIndex = index;
      switch (index) {
        case 0:
          selectedPage = _buildHomePage();
          break;
        case 1:
          selectedPage = HomePage(username: username, password: password, listBug: listBug, role: role, expiredDate: expiredDate, sessionKey: sessionKey);
          break;
        case 2:
          selectedPage = InfoPage(sessionKey: sessionKey);
          break;
        case 3:
          selectedPage = ToolsPage(sessionKey: sessionKey, userRole: role, listDoos: listDoos);
          break;
        case 4:
          selectedPage = DeviceDashboardPage(username: username, role: role, sessionKey: sessionKey);
          break;
      }
    });
  }

  void onSidebarTabSelected(int index) {
    Navigator.pop(context);
    Future.delayed(const Duration(milliseconds: 200), () {
      setState(() {
        switch (index) {
          case 1:
            selectedPage = SellerPage(keyToken: sessionKey);
            break;
          case 2:
            selectedPage = AdminPage(
              sessionKey: sessionKey,
              role: role,
            );
            break;
          case 3:
            selectedPage = OwnerPage(
              sessionKey: sessionKey,
              username: username,
            );
            break;
          case 4:
            selectedPage = PartnerPage(
              sessionKey: sessionKey,
              username: username,
            );
            break;
        }
      });
    });
  }

  List<Map<String, dynamic>> get quickActions {
    return [
      {"icon": Icons.bug_report_rounded, "label": "Manage Bug", "color": accentRed, "onTap": () { Navigator.push(context, MaterialPageRoute(builder: (context) => BugSenderPage(sessionKey: sessionKey, username: username, role: role))); }},
      {"icon": FontAwesomeIcons.telegram, "label": "Join Channel", "color": const Color(0xFF0088cc), "onTap": () => openUrl("https://t.me/RevXteam")},
      {"icon": Icons.chat_rounded, "label": "Room Public", "color": Colors.purple, "onTap": () { Navigator.push(context, MaterialPageRoute(builder: (context) => PublicChatPage(sessionKey: sessionKey, username: username, role: role))); }},
      {"icon": Icons.live_tv_rounded, "label": "Anime Stream", "color": Colors.deepOrange, "onTap": () { Navigator.push(context, MaterialPageRoute(builder: (context) => const HomeAnimePage())); }},
      {"icon": Icons.favorite_rounded, "label": "Thanks To", "color": Colors.pink, "onTap": () { Navigator.push(context, MaterialPageRoute(builder: (context) => const ThanksToPage())); }},
      {"icon": Icons.music_note_rounded, "label": "Spotify", "color": Colors.green, "onTap": () { Navigator.push(context, MaterialPageRoute(builder: (context) => const SpotifyMusicPage())); }},
    ];
  }

  Widget _buildHomePage() {
    final isOwnerOrPartner = isAtLeast('partner');
    final isAdminOrAbove = isAtLeast('admin');
    final isReseller = isRole('reseller');
    
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // HEADER - SEPERTI DI FOTO
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [accentRed.withOpacity(0.1), darkRed.withOpacity(0.05)],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Welcome Back",
                  style: TextStyle(color: softGrey, fontSize: 14, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 4),
                Text(
                  username,
                  style: const TextStyle(
                    color: primaryWhite,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    role.toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFFF59E0B),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: glassSecondary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      "DirzZX Beta DASHBOARD",
                      style: TextStyle(
                        color: accentRed,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // STATS CARDS - SEPERTI DI FOTO (ONLINE USERS + LIVE, ACTIVE CONNECTIONS)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                // ONLINE USERS dengan badge LIVE
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [glassPrimary, glassSecondary],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: primaryWhite.withOpacity(0.1)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Online Users",
                          style: TextStyle(color: softGrey, fontSize: 12, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Text(
                              "$_onlineUsers",
                              style: const TextStyle(
                                color: successGreen,
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.red,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                "LIVE",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                // ACTIVE CONNECTIONS
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [glassPrimary, glassSecondary],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: primaryWhite.withOpacity(0.1)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Active Connections",
                          style: TextStyle(color: softGrey, fontSize: 12, fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          "$_activeConnections",
                          style: TextStyle(
                            color: Colors.orange.shade400,
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // EXPIRATION CARD - SEPERTI DI FOTO
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [accentRed.withOpacity(0.15), darkRed.withOpacity(0.1)],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: accentRed.withOpacity(0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "Expiration",
                    style: TextStyle(color: softGrey, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  Text(
                    expiredDate,
                    style: const TextStyle(
                      color: primaryWhite,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),

          // QUICK ACTIONS
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(width: 4, height: 28, decoration: BoxDecoration(gradient: redGradient, borderRadius: BorderRadius.circular(2))),
                const SizedBox(width: 12),
                const Text("QUICK ACTIONS", style: TextStyle(color: softGrey, fontSize: 14, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 0.85),
              itemCount: quickActions.length,
              itemBuilder: (context, index) {
                final action = quickActions[index];
                return _buildQuickAction(
                  icon: action['icon'] as IconData,
                  label: action['label'] as String,
                  color: action['color'] as Color,
                  onTap: action['onTap'] as VoidCallback,
                );
              },
            ),
          ),

          const SizedBox(height: 32),

          // ISLAMIC FEATURES
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(width: 4, height: 28, decoration: BoxDecoration(gradient: redGradient, borderRadius: BorderRadius.circular(2))),
                const SizedBox(width: 12),
                const Text("ISLAMIC FEATURES", style: TextStyle(color: softGrey, fontSize: 14, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: _buildIslamicCard(
                    icon: Icons.access_time_rounded,
                    label: "Jadwal Sholat",
                    subtitle: "Prayer Schedule",
                    gradientColors: const [Color(0xFF00C853), Color(0xFF00E676)],
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const JadwalSholatPage())),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildIslamicCard(
                    icon: Icons.menu_book_rounded,
                    label: "Hadis",
                    subtitle: "Islamic Hadith",
                    gradientColors: const [Color(0xFF00897B), Color(0xFF00ACC1)],
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const HadisPage())),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          // EXTRA TOOLS
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(width: 4, height: 28, decoration: BoxDecoration(gradient: redGradient, borderRadius: BorderRadius.circular(2))),
                const SizedBox(width: 12),
                const Text("EXTRA TOOLS", style: TextStyle(color: softGrey, fontSize: 14, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 0.85),
              itemCount: extraTools.length,
              itemBuilder: (context, index) {
                final tool = extraTools[index];
                return _buildQuickAction(
                  icon: tool['icon'] as IconData,
                  label: tool['label'] as String,
                  color: tool['color'] as Color,
                  onTap: () {
                    if (tool['page'] != null) {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => tool['page'] as Widget));
                    } else if (tool['isDialog'] == true) {
                      if (tool['dialogType'] == "prophets") _showProphetsDialog();
                      else if (tool['dialogType'] == "asmaul") _showAsmaulHusnaDialog();
                      else if (tool['dialogType'] == "enc") _showEncFileDialog();
                      else if (tool['dialogType'] == "no_enc") _showNoEncFileDialog();
                    }
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  void _showProphetsDialog() {
    final List<Map<String, String>> prophets = [
      {"name": "Nabi Adam AS", "desc": "Nabi pertama"}, {"name": "Nabi Idris AS", "desc": "Pandai menulis"},
      {"name": "Nabi Nuh AS", "desc": "Membangun bahtera"}, {"name": "Nabi Ibrahim AS", "desc": "Khalilullah"},
      {"name": "Nabi Musa AS", "desc": "Menerima Taurat"}, {"name": "Nabi Isa AS", "desc": "Menerima Injil"},
      {"name": "Nabi Muhammad SAW", "desc": "Nabi terakhir"},
    ];
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1F3F),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text("Nama Nabi", style: TextStyle(color: accentRed, fontWeight: FontWeight.bold)),
        content: SizedBox(
          width: double.maxFinite,
          height: 300,
          child: ListView.builder(
            itemCount: prophets.length,
            itemBuilder: (context, index) => ListTile(
              title: Text(prophets[index]["name"]!, style: const TextStyle(color: Colors.white)),
              subtitle: Text(prophets[index]["desc"]!, style: const TextStyle(color: softGrey)),
            ),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(_), child: const Text("Tutup", style: TextStyle(color: accentRed)))],
      ),
    );
  }

  void _showAsmaulHusnaDialog() {
    final List<Map<String, String>> asmaul = [
      {"name": "Ar-Rahman", "meaning": "Maha Pengasih"}, {"name": "Ar-Rahim", "meaning": "Maha Penyayang"},
      {"name": "Al-Malik", "meaning": "Maha Merajai"}, {"name": "Al-Quddus", "meaning": "Maha Suci"},
      {"name": "As-Salam", "meaning": "Maha Sejahtera"}, {"name": "Al-Mu'min", "meaning": "Maha Memberi Keamanan"},
    ];
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1F3F),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text("Asmaul Husna", style: TextStyle(color: accentRed, fontWeight: FontWeight.bold)),
        content: SizedBox(
          width: double.maxFinite,
          height: 300,
          child: ListView.builder(
            itemCount: asmaul.length,
            itemBuilder: (context, index) => ListTile(
              title: Text(asmaul[index]["name"]!, style: const TextStyle(color: Colors.white)),
              subtitle: Text(asmaul[index]["meaning"]!, style: const TextStyle(color: softGrey)),
            ),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(_), child: const Text("Tutup", style: TextStyle(color: accentRed)))],
      ),
    );
  }

  void _showEncFileDialog() {
    final TextEditingController controller = TextEditingController();
    String? result;
    showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          backgroundColor: const Color(0xFF1A1F3F),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text("ENC File - Encode", style: TextStyle(color: accentRed)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: "Masukkan teks",
                  hintStyle: TextStyle(color: softGrey),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              if (result != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(12)),
                  child: SelectableText(result!, style: const TextStyle(color: accentRed)),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                if (controller.text.isNotEmpty) {
                  setStateDialog(() { result = base64Encode(utf8.encode(controller.text)); });
                }
              },
              child: const Text("Encode", style: TextStyle(color: accentRed)),
            ),
            TextButton(onPressed: () => Navigator.pop(_), child: const Text("Tutup", style: TextStyle(color: accentRed))),
          ],
        ),
      ),
    );
  }

  void _showNoEncFileDialog() {
    final TextEditingController controller = TextEditingController();
    String? result;
    showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          backgroundColor: const Color(0xFF1A1F3F),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text("NO ENC File - Decode", style: TextStyle(color: accentRed)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: "Masukkan Base64",
                  hintStyle: TextStyle(color: softGrey),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              if (result != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(12)),
                  child: SelectableText(result!, style: const TextStyle(color: accentRed)),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                if (controller.text.isNotEmpty) {
                  try {
                    setStateDialog(() { result = utf8.decode(base64Decode(controller.text)); });
                  } catch (e) {
                    setStateDialog(() { result = "Error: Format tidak valid"; });
                  }
                }
              },
              child: const Text("Decode", style: TextStyle(color: accentRed)),
            ),
            TextButton(onPressed: () => Navigator.pop(_), child: const Text("Tutup", style: TextStyle(color: accentRed))),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickAction({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [glassPrimary, glassSecondary]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [color.withOpacity(0.2), color.withOpacity(0.1)]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Text(
                label,
                style: const TextStyle(color: primaryWhite, fontWeight: FontWeight.w600, fontSize: 10),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIslamicCard({required IconData icon, required String label, required String subtitle, required List<Color> gradientColors, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [glassPrimary, glassSecondary]),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: primaryWhite.withOpacity(0.1)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: gradientColors),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: primaryWhite, size: 28),
            ),
            const SizedBox(height: 12),
            Text(label, style: const TextStyle(color: primaryWhite, fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 4),
            Text(subtitle, style: TextStyle(color: softGrey, fontSize: 10)),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawer() {
    final isOwner = isRole('owner');
    final isPartner = isRole('partner');
    final isReseller = isRole('reseller');
    final isAtLeastAdmin = isAtLeast('admin');
    
    return Drawer(
      backgroundColor: bgDark,
      width: MediaQuery.of(context).size.width * 0.85,
      child: Column(
        children: [
          Container(
            height: 280,
            decoration: BoxDecoration(
              gradient: isOwner || isPartner 
                  ? const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFD97706)])
                  : redGradient,
            ),
            child: SafeArea(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: primaryWhite, width: 3),
                      ),
                      child: ClipOval(
                        child: profileImage != null
                            ? Image.file(profileImage!, fit: BoxFit.cover)
                            : Container(
                                decoration: BoxDecoration(gradient: secondaryGradient),
                                child: Icon(FontAwesomeIcons.userAstronaut, size: 45, color: primaryWhite),
                              ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(username, style: const TextStyle(color: primaryWhite, fontSize: 20, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                      decoration: BoxDecoration(
                        color: primaryWhite.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(getRoleIconForBadge(), style: const TextStyle(fontSize: 12)),
                          const SizedBox(width: 6),
                          Text(role.toUpperCase(), style: const TextStyle(color: primaryWhite, fontSize: 11, fontWeight: FontWeight.w700)),
                          if (isOwner || isPartner)
                            const SizedBox(width: 6),
                          if (isOwner || isPartner)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                "FULL",
                                style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 20),
              children: [
                if (isReseller)
                  _buildDrawerItem(icon: Icons.storefront_rounded, label: "Seller Page", onTap: () => onSidebarTabSelected(1)),
                
                if (isAtLeastAdmin)
                  _buildDrawerItem(
                    icon: Icons.admin_panel_settings_rounded, 
                    label: isOwner || isPartner ? "Admin Panel (Full Access)" : "Admin Page", 
                    onTap: () => onSidebarTabSelected(2),
                    isSpecial: isOwner || isPartner,
                  ),
                
                if (isOwner)
                  _buildDrawerItem(
                    icon: Icons.workspace_premium_rounded, 
                    label: "Owner Dashboard", 
                    onTap: () => onSidebarTabSelected(3),
                    isSpecial: true,
                  ),
                
                if (isPartner)
                  _buildDrawerItem(
                    icon: Icons.people_alt_rounded, 
                    label: "Partner Dashboard", 
                    onTap: () => onSidebarTabSelected(4),
                    isSpecial: true,
                  ),
                
                _buildDrawerItem(icon: Icons.history_rounded, label: "Riwayat Aktivitas", onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (context) => RiwayatPage(sessionKey: sessionKey, role: role)));
                }),
                const Divider(color: Colors.white10, height: 32),
                _buildDrawerItem(icon: Icons.logout_rounded, label: "Log Out", isLogout: true, onTap: () async {
                  WebSocketManager.instance.disconnect();
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.clear();
                  if (!mounted) return;
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (context) => const LoginPage()),
                    (route) => false,
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerItem({required IconData icon, required String label, required VoidCallback onTap, bool isLogout = false, bool isSpecial = false}) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        gradient: isSpecial && !isLogout
            ? LinearGradient(
                colors: [const Color(0xFFF59E0B).withOpacity(0.15), const Color(0xFFF59E0B).withOpacity(0.05)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: isLogout ? Colors.red.withOpacity(0.1) : (isSpecial ? null : glassSecondary),
        borderRadius: BorderRadius.circular(16),
        border: isSpecial && !isLogout
            ? Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3))
            : null,
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isLogout ? Colors.red.withOpacity(0.15) : (isSpecial ? const Color(0xFFF59E0B).withOpacity(0.2) : accentRed.withOpacity(0.1)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: isLogout ? Colors.redAccent : (isSpecial ? const Color(0xFFF59E0B) : accentRed), size: 20),
        ),
        title: Text(
          label,
          style: TextStyle(
            color: isLogout ? Colors.redAccent : (isSpecial ? const Color(0xFFF59E0B) : primaryWhite),
            fontWeight: FontWeight.w600,
          ),
        ),
        trailing: isSpecial && !isLogout
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  "FULL",
                  style: TextStyle(color: Color(0xFFF59E0B), fontSize: 9, fontWeight: FontWeight.bold),
                ),
              )
            : null,
        onTap: onTap,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(gradient: redGradient, borderRadius: BorderRadius.circular(30)),
          child: const Text("DirzZX Beta", style: TextStyle(color: primaryWhite, fontWeight: FontWeight.w700, fontSize: 14)),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: primaryWhite),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(color: glassSecondary, borderRadius: BorderRadius.circular(14)),
            child: IconButton(
              icon: Icon(Icons.headset_mic_rounded, color: accentRed),
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const ContactPage())),
            ),
          ),
          Container(
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(color: glassSecondary, borderRadius: BorderRadius.circular(14)),
            child: IconButton(
              icon: Icon(FontAwesomeIcons.circleUser, color: accentRed),
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => ProfilePage(username: username, password: password, role: role, expiredDate: expiredDate, sessionKey: sessionKey)),
              ),
            ),
          ),
        ],
      ),
      drawer: _buildDrawer(),
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.5,
            colors: [accentRed.withOpacity(0.15), bgDark, bgDark],
          ),
        ),
        child: CustomPaint(
          painter: _GridPainter(),
          child: SafeArea(
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SlideTransition(position: _slideAnimation, child: selectedPage),
            ),
          ),
        ),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: glassPrimary,
          border: Border(top: BorderSide(color: primaryWhite.withOpacity(0.08))),
          borderRadius: const BorderRadius.only(topLeft: Radius.circular(24), topRight: Radius.circular(24)),
        ),
        child: BottomNavigationBar(
          backgroundColor: Colors.transparent,
          selectedItemColor: accentRed,
          unselectedItemColor: softGrey,
          currentIndex: bottomNavIndex,
          onTap: onBottomNavTapped,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard_rounded), label: "Home"),
            BottomNavigationBarItem(icon: Icon(FontAwesomeIcons.whatsapp), label: "WhatsApp"),
            BottomNavigationBarItem(icon: Icon(Icons.notifications_active_rounded), label: "Info"),
            BottomNavigationBarItem(icon: Icon(Icons.build_rounded), label: "Tools"),
            BottomNavigationBarItem(icon: Icon(Icons.devices_rounded), label: "RAT"),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _statsTimer?.cancel();
    WebSocketManager.instance.removeStatusListener(_onConnectionStatusChanged);
    WebSocketManager.instance.removeStatsListener(_onStatsUpdate);
    WebSocketManager.instance.removeErrorListener(_onConnectionError);
    _animationController.dispose();
    super.dispose();
  }
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withOpacity(0.02)..strokeWidth = 0.8;
    const gridSize = 30.0;
    for (double x = 0; x <= size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y <= size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    final accentPaint = Paint()..color = accentRed.withOpacity(0.08)..strokeWidth = 1.5;
    for (double x = 0; x <= size.width; x += gridSize * 5) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), accentPaint);
    }
    for (double y = 0; y <= size.height; y += gridSize * 5) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), accentPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ============ STUB PAGES ============
class BiblePage extends StatelessWidget {
  const BiblePage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(title: const Text("Alkitab"), backgroundColor: accentRed),
      body: const Center(child: Text("Bible Page", style: TextStyle(color: Colors.white))),
    );
  }
}

class QuranPage extends StatelessWidget {
  const QuranPage({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(title: const Text("Al-Qur'an"), backgroundColor: accentRed),
      body: const Center(child: Text("Quran Page", style: TextStyle(color: Colors.white))),
    );
  }
}