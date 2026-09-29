import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
/// SWAR MANGAL — design system
///
/// Warm ivory canvas, white cards on hairline borders, and a single gold/brass
/// accent for primary actions and the few things that deserve the eye (a
/// selected tab, a headline figure) — matching the website dashboard's
/// --dash-* palette exactly, light and dark. Inter for everything you read;
/// Playfair Display only for display headings and hero numbers.
/// Premium here means restraint: one accent, quiet borders, generous space.
/// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
class AppColors {
  AppColors._();

  // Canvas and surfaces — exact hex equivalents of the website's --dash-*
  // design tokens (src/app/globals.css), so both apps read as one product.
  static const background = Color(0xFFF8F6F2); // --dash-bg (light)
  static const pageBg = background; // alias for existing callers
  static const surface = Color(0xFFFFFFFF); // --dash-card (light)
  static const surfaceAlt = Color(0xFFFBFAF9); // --dash-elevated (light)
  static const line = Color(0xFFE6E1D7);
  static const border = line; // alias

  // Ink.
  static const ink = Color(0xFF1C1925); // --dash-fg (light)
  static const textPrimary = ink; // alias
  static const muted = Color(0xFF6B675F);
  static const textSecondary = muted; // alias

  // Brand accent — the website's single gold/brass accent (--dash-accent),
  // used as both primary and secondary here instead of a separate indigo.
  static const primary = Color(0xFFB47A22); // --dash-accent (light)
  static const primaryLight = Color(0xFF2E3864);
  static const brass = Color(0xFF956318); // --dash-accent-hover (light)
  static const brassSoft = Color(0xFFF3ECDF);
  static const secondaryAccent = brass;
  static const lavenderSoft = brassSoft; // alias: soft accent tint
  static const gold = brass;
  static const focus = Color(0xFF956318); // --dash-accent-hover (light)

  // Deep surfaces (brand panel, dark chrome).
  static const navy = Color(0xFF151B31);
  static const primaryDark = Color(0xFF0F1426);

  // Semantic (light).
  static const okFg = Color(0xFF2E7753);
  static const okBg = Color(0xFFE3F0E8);
  static const warnFg = Color(0xFF9E640E);
  static const warnBg = Color(0xFFF6ECD8);
  static const blockFg = Color(0xFFAE3A30);
  static const blockBg = Color(0xFFF7E5E2);
  static const infoFg = Color(0xFF34508F);
  static const infoBg = Color(0xFFE7ECF6);
  static const mint = okBg;
  static const vsuccess = okFg;
  static const success = okFg;
  static const error = blockFg;

  // Dark variant — "studio at night", matching the website's dark --dash-*
  // tokens exactly.
  static const dPageBg = Color(0xFF08070B); // --dash-bg (dark)
  static const dSurface = Color(0xFF131019); // --dash-card (dark)
  static const dSurfaceAlt = Color(0xFF121016); // --dash-elevated (dark)
  static const dLine = Color(0xFF2B303B);
  static const dInk = Color(0xFFF7F2E8); // --dash-fg (dark)
  static const dMuted = Color(0xFFA39E94);
  static const dPrimary = Color(0xFFD6A84F); // --dash-accent (dark)
  static const dFocus = Color(0xFFE2BD68); // --dash-accent-hover (dark)
  static const dOkFg = Color(0xFF72C79E);
  static const dOkBg = Color(0xFF15291F);
  static const dWarnFg = Color(0xFFE4B266);
  static const dWarnBg = Color(0xFF2E2415);
  static const dBlockFg = Color(0xFFEE8B80);
  static const dBlockBg = Color(0xFF34191A);
  static const dInfoFg = Color(0xFFA3B8E8);
  static const dInfoBg = Color(0xFF1A2236);

  /// Maps any named light-mode color to its dark-mode counterpart when the
  /// current theme is dark, otherwise returns it unchanged. Use this at every
  /// call site that references a color like `AppColors.muted` or
  /// `AppColors.warnFg` directly instead of through `Theme.of(context)` —
  /// those are compile-time constants and never adapt to dark mode on their
  /// own. Extracted from the pattern `StatusBadge` already used correctly.
  static Color adaptive(BuildContext context, Color light) {
    if (Theme.of(context).brightness != Brightness.dark) return light;
    if (light == ink) return dInk;
    if (light == muted) return dMuted;
    if (light == surface) return dSurface;
    if (light == surfaceAlt) return dSurfaceAlt;
    if (light == line) return dLine;
    if (light == background) return dPageBg;
    if (light == primary) return dPrimary;
    if (light == focus) return dFocus;
    if (light == okFg) return dOkFg;
    if (light == okBg) return dOkBg;
    if (light == warnFg) return dWarnFg;
    if (light == warnBg) return dWarnBg;
    if (light == blockFg) return dBlockFg;
    if (light == blockBg) return dBlockBg;
    if (light == infoFg) return dInfoFg;
    if (light == infoBg) return dInfoBg;
    return light;
  }
}

class AppSpace {
  AppSpace._();
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 24.0;
  static const s6 = 32.0;
  static const s7 = 48.0;
}

/// Radius system. Small=8 · input/button=12 · card=16 · hero=22.
class AppRadius {
  AppRadius._();
  static const small = 8.0;
  static const s = 12.0;
  static const button = s;
  static const input = s;
  static const card = 16.0;
  static const m = card;
  static const large = 22.0;
  static const l = large;
  static const pill = 999.0;
}

/// Shadows — barely there. Borders do the separating.
class AppShadows {
  AppShadows._();
  static const subtle = BoxShadow(color: Color(0x0A171A26), blurRadius: 4, offset: Offset(0, 1));
  static const card = BoxShadow(color: Color(0x0D171A26), blurRadius: 16, offset: Offset(0, 4));
  static const dialog = BoxShadow(color: Color(0x26171A26), blurRadius: 36, offset: Offset(0, 14));
  static const hover = BoxShadow(color: Color(0x17171A26), blurRadius: 22, offset: Offset(0, 8));
}

class AppGradients {
  AppGradients._();

  /// The brand panel: midnight with a faint lift toward the top-left.
  static const primary = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2A335C), Color(0xFF151B31)],
  );
  static const primaryStrong = primary;

  /// Thin brass rule used under hero headings.
  static const brass = LinearGradient(colors: [Color(0xFFC9A46A), Color(0xFFA9824A)]);

  // Kept for callers; the canvas no longer uses moving blobs.
  static const blobLavender = RadialGradient(colors: [Color(0x00000000), Color(0x00000000)]);
  static const blobMint = blobLavender;
}

class AppFonts {
  AppFonts._();
  static const body = 'Inter';
  static const display = 'PlayfairDisplay';
}

class AppType {
  AppType._();
  static const eyebrow = TextStyle(fontFamily: AppFonts.body, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1.4);
  static const display = TextStyle(fontFamily: AppFonts.display, fontSize: 28, fontWeight: FontWeight.w600, height: 1.15);
  static const h1 = TextStyle(fontFamily: AppFonts.display, fontSize: 26, fontWeight: FontWeight.w600, height: 1.2);
  static const h2 = TextStyle(fontFamily: AppFonts.body, fontSize: 19, fontWeight: FontWeight.w600, height: 1.25);
  static const title = TextStyle(fontFamily: AppFonts.body, fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: -.2);
  static const cardTitle = TextStyle(fontFamily: AppFonts.body, fontSize: 15, fontWeight: FontWeight.w600);
  static const body = TextStyle(fontFamily: AppFonts.body, fontSize: 14, height: 1.45);
  static const small = TextStyle(fontFamily: AppFonts.body, fontSize: 12);
  static const caption = TextStyle(fontFamily: AppFonts.body, fontSize: 11);
  static const numbers = TextStyle(
    fontFamily: AppFonts.display,
    fontSize: 34,
    fontWeight: FontWeight.w600,
    letterSpacing: -.3,
    fontFeatures: [FontFeature.tabularFigures()],
  );
  static const figure = TextStyle(
    fontFamily: AppFonts.body,
    fontWeight: FontWeight.w600,
    fontFeatures: [FontFeature.tabularFigures()],
  );
}

class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final ink = dark ? AppColors.dInk : AppColors.ink;
    final muted = dark ? AppColors.dMuted : AppColors.muted;
    final line = dark ? AppColors.dLine : AppColors.line;
    final bg = dark ? AppColors.dPageBg : AppColors.background;
    final surface = dark ? AppColors.dSurface : AppColors.surface;
    final surfaceAlt = dark ? AppColors.dSurfaceAlt : AppColors.surfaceAlt;
    final primary = dark ? AppColors.dPrimary : AppColors.primary;
    final onPrimary = dark ? const Color(0xFF1B1407) : Colors.white;
    final blockFg = dark ? AppColors.dBlockFg : AppColors.blockFg;
    final accent = dark ? AppColors.dPrimary : AppColors.brass;

    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: brightness,
      primary: primary,
      onPrimary: onPrimary,
      secondary: accent,
      onSecondary: dark ? const Color(0xFF1B1407) : Colors.white,
      tertiary: dark ? AppColors.dFocus : AppColors.focus,
      surface: surface,
      onSurface: ink,
      onSurfaceVariant: muted,
      surfaceContainerHighest: surfaceAlt,
      surfaceContainerHigh: surfaceAlt,
      surfaceContainer: surfaceAlt,
      surfaceContainerLow: surface,
      outline: line,
      outlineVariant: line,
      error: blockFg,
    );

    final base = ThemeData(useMaterial3: true, brightness: brightness, fontFamily: AppFonts.body);
    final text = base.textTheme.apply(bodyColor: ink, displayColor: ink, fontFamily: AppFonts.body);

    OutlineInputBorder outline(Color c, [double w = 1]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.input),
          borderSide: BorderSide(color: c, width: w),
        );

    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      canvasColor: bg,
      textTheme: text.copyWith(
        displaySmall: AppType.display.copyWith(color: ink),
        headlineMedium: AppType.h1.copyWith(color: ink),
        headlineSmall: AppType.h2.copyWith(color: ink),
        titleLarge: AppType.title.copyWith(color: ink, fontSize: 20),
        titleMedium: AppType.title.copyWith(color: ink),
        titleSmall: AppType.cardTitle.copyWith(color: ink),
        bodyLarge: AppType.body.copyWith(color: ink, fontSize: 15),
        bodyMedium: AppType.body.copyWith(color: ink),
        bodySmall: AppType.small.copyWith(color: muted),
        labelLarge: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, letterSpacing: .1),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: bg,
        foregroundColor: ink,
        elevation: 0,
        centerTitle: false,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: AppType.title.copyWith(color: ink, fontSize: 18),
        iconTheme: IconThemeData(color: ink, size: 22),
        actionsIconTheme: IconThemeData(color: muted, size: 22),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: BorderSide(color: line),
        ),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: DividerThemeData(color: line, thickness: 1, space: 1),
      listTileTheme: ListTileThemeData(
        iconColor: muted,
        titleTextStyle: AppType.cardTitle.copyWith(color: ink, fontSize: 14.5),
        subtitleTextStyle: AppType.small.copyWith(color: muted),
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpace.s4),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: 14),
        labelStyle: TextStyle(color: muted, fontFamily: AppFonts.body),
        floatingLabelStyle: TextStyle(color: dark ? AppColors.dPrimary : AppColors.primary, fontWeight: FontWeight.w600),
        hintStyle: TextStyle(color: muted.withValues(alpha: .75)),
        helperStyle: TextStyle(color: muted, fontSize: 12),
        prefixIconColor: muted,
        suffixIconColor: muted,
        border: outline(line),
        enabledBorder: outline(line),
        focusedBorder: outline(primary, 1.6),
        errorBorder: outline(blockFg),
        focusedErrorBorder: outline(blockFg, 1.6),
        disabledBorder: outline(line.withValues(alpha: .6)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          minimumSize: const Size(0, 50),
          padding: const EdgeInsets.symmetric(horizontal: AppSpace.s5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.button)),
          textStyle: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, fontSize: 15, letterSpacing: .1),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          minimumSize: const Size(0, 50),
          padding: const EdgeInsets.symmetric(horizontal: AppSpace.s5),
          side: BorderSide(color: line),
          backgroundColor: surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.button)),
          textStyle: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: dark ? AppColors.dPrimary : AppColors.primary,
          textStyle: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surface,
        selectedColor: primary,
        secondarySelectedColor: primary,
        side: BorderSide(color: line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.pill)),
        labelStyle: TextStyle(color: ink, fontFamily: AppFonts.body, fontWeight: FontWeight.w500),
        secondaryLabelStyle: TextStyle(color: onPrimary, fontFamily: AppFonts.body, fontWeight: FontWeight.w600),
        checkmarkColor: onPrimary,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          side: WidgetStatePropertyAll(BorderSide(color: line)),
          backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? primary : surface),
          foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? onPrimary : ink),
          textStyle: const WidgetStatePropertyAll(TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600, fontSize: 13)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        indicatorColor: dark ? AppColors.dPrimary.withValues(alpha: .18) : AppColors.brassSoft,
        indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.pill)),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
              size: 23,
              color: s.contains(WidgetState.selected) ? (dark ? AppColors.dPrimary : AppColors.primary) : muted,
            )),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
              fontFamily: AppFonts.body,
              fontSize: 11.5,
              fontWeight: s.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
              color: s.contains(WidgetState.selected) ? ink : muted,
            )),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: ink,
        unselectedLabelColor: muted,
        indicatorColor: accent,
        dividerColor: line,
        labelStyle: const TextStyle(fontFamily: AppFonts.body, fontWeight: FontWeight.w600),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: dark ? AppColors.dSurfaceAlt : AppColors.navy,
        elevation: 0,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13.5, fontFamily: AppFonts.body),
        actionTextColor: AppColors.dPrimary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.s)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: primary, linearTrackColor: line),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.large)),
        elevation: 0,
        titleTextStyle: AppType.title.copyWith(color: ink, fontSize: 19),
        contentTextStyle: AppType.body.copyWith(color: muted),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: line,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.large))),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.s), side: BorderSide(color: line)),
        textStyle: AppType.body.copyWith(color: ink),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? onPrimary : muted),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? primary : surfaceAlt),
        trackOutlineColor: WidgetStatePropertyAll(line),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? primary : Colors.transparent),
        checkColor: WidgetStatePropertyAll(onPrimary),
        side: BorderSide(color: muted, width: 1.4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        headerBackgroundColor: dark ? AppColors.dSurfaceAlt : AppColors.navy,
        headerForegroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.large)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card)),
      ),
      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStatePropertyAll(muted.withValues(alpha: .4)),
        radius: const Radius.circular(4),
        thickness: const WidgetStatePropertyAll(4),
      ),
    );
  }
}

/// Theme-mode controller — persisted, restored on boot.
class ThemeController with ChangeNotifier {
  ThemeController(this._mode);
  ThemeMode _mode;
  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> setMode(ThemeMode mode) async {
    if (_mode == mode) return;
    _mode = mode;
    notifyListeners();
    await _persist(mode);
  }

  Future<void> toggle() async => setMode(isDark ? ThemeMode.light : ThemeMode.dark);

  Future<void> _persist(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('theme_mode', mode == ThemeMode.dark ? 'dark' : 'light');
  }

  static Future<ThemeMode> restore() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('theme_mode') == 'dark' ? ThemeMode.dark : ThemeMode.light;
  }
}
