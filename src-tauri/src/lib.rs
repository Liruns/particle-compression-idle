use tauri::{
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
  Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 창 위치·크기 기억(위젯을 놓아둔 자리를 재실행 때 복원).
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 시스템 트레이 — 프레임리스 위젯이라 보이기/숨기기·종료를 트레이 메뉴로(방치형 상주 자연스러움).
      let toggle = MenuItem::with_id(app, "toggle", "위젯 보이기/숨기기", true, None::<&str>)?;
      let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&toggle, &quit])?;
      let mut tray = TrayIconBuilder::new()
        .tooltip("입자 압축 · 코스믹 위젯")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "toggle" => {
            if let Some(win) = app.get_webview_window("widget") {
              if win.is_visible().unwrap_or(true) {
                let _ = win.hide();
              } else {
                let _ = win.show();
                let _ = win.set_focus();
              }
            }
          }
          "quit" => app.exit(0),
          _ => {}
        });
      if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
      }
      tray.build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
