# ADR-0004. PlatformAdapter: доступ к ОС через `shared/platform`

Дата: 2026-10-17 · Статус: принято

## Контекст

PRD 11.0: тот же web-код работает в браузере и в Tauri 2 (Windows, SCRUM-12). Уведомления, медиаустройства,
захват экрана и автозапуск в браузере и в desktop устроены по-разному. Если фичи зовут браузерные API
напрямую, desktop-версия потребует правок по всему `src/`.

## Решение

- `src/shared/platform` описывает интерфейс `PlatformAdapter`: `notifications`, `mediaDevices`, `screenCapture`,
  `autostart`. Web-реализация `createWebPlatform()` использует браузерные API.
- Реализация берётся через модульный аксессор `getPlatform()`: по умолчанию web, `setPlatform(adapter)` подменяет.
  Desktop-точка входа вызовет `setPlatform(createTauriPlatform())` до рендера. Тесты ставят
  `createFakePlatform()` из `@/shared/lib/test` и сбрасывают `setPlatform(null)`.
  Аксессор, а не React-контекст: адаптер нужен и вне компонентов, и он не меняется во время работы.
- Ошибки на любой платформе — `DOMException` с браузерными именами (`NotAllowedError`, `NotFoundError`,
  `NotSupportedError`), чтобы фичи обрабатывали один набор.
- ESLint вне `src/shared/platform/**` запрещает `navigator.mediaDevices`, `Notification`, вызовы `getUserMedia`,
  `getDisplayMedia`, `enumerateDevices`, импорт `@tauri-apps/*` и livekit-хелперы `createLocalTracks`,
  `createLocalScreenTracks`, `createLocalVideoTrack`, которые захватывают медиа в обход адаптера.

## Что остаётся внутри livekit-client

- **Захват экрана — через адаптер.** `features/share-screen` получает треки от `screenCapture.capture()` и
  публикует их через `publishTrack(track, { source: ScreenShare | ScreenShareAudio })`. Остановка — по-прежнему
  `setScreenShareEnabled(false)`: livekit снимает с публикации и останавливает видео и звук экрана. Если трек
  закончился сам (кнопка «Закрыть доступ» в браузере или ОС), livekit снимает его с публикации по источнику
  `ScreenShare`, так что для «своих» треков это тоже работает.
- **Микрофон захватывает livekit** (`setMicrophoneEnabled(true)` → `getUserMedia` внутри). Свой трек
  (`publishTrack(MediaStreamTrack)`) livekit считает «предоставленным пользователем» и для него отключает:
  переключение на новое устройство по умолчанию, повторный захват после пропажи устройства, перезапуск трека
  после переподключения и после возврата вкладки из фона. Для gate этапа (30 минут без обрывов) это важнее.
  В WebView2 `getUserMedia` работает и так, Tauri-реализация тут не нужна.
- **Выбор устройств (SCRUM-20):** список и событие подключения — `getPlatform().mediaDevices`; применение —
  `room.switchActiveDevice(kind, deviceId)` или `setMicrophoneEnabled(true, { deviceId })`: livekit сам перезахватывает
  микрофон с этим `deviceId`. Динамики — `switchActiveDevice('audiooutput', id)` (`setSinkId` у элементов).
- Внутри livekit также остаются `enumerateDevices` и подписка на `devicechange` для его автопереключения.

## Последствия

- Tauri-реализация (SCRUM-12) пишется в `src/shared/platform` и меняет только точку входа.
- Если нужно управлять микрофоном самим (шумоподавление, свой процессор), понадобится метод захвата в адаптере
  и своя обработка смены устройств. Тогда это решение нужно пересмотреть.
