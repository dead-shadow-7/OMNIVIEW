const {
    app: app,
    BrowserWindow: BrowserWindow,
    Menu: Menu,
    ipcMain: ipcMain,
  } = require("electron"),
  path = require("path"),
  fs = require("fs"),
  template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("menu-new-project");
          },
        },
        {
          label: "Open Project",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow.webContents.send("menu-open-project");
          },
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow.webContents.send("menu-save");
          },
        },
        { type: "separator" },
        {
          label: "Export Map",
          click: () => {
            mainWindow.webContents.send("menu-export-map");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: "darwin" === process.platform ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => {
            mainWindow.webContents.send("toggle-sidebar");
          },
        },
        {
          label: "Toggle Logs Panel",
          accelerator: "CmdOrCtrl+L",
          click: () => {
            mainWindow.webContents.send("toggle-logs");
          },
        },
        { type: "separator" },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          click: () => {
            mainWindow.webContents.send("map-zoom-in");
          },
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            mainWindow.webContents.send("map-zoom-out");
          },
        },
        {
          label: "Reset Zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            mainWindow.webContents.send("map-reset-zoom");
          },
        },
        { type: "separator" },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.reload();
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator:
            "darwin" === process.platform ? "Alt+Cmd+I" : "Ctrl+Shift+I",
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: "Settings",
      submenu: [
        {
          label: "Preferences",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            mainWindow.webContents.send("open-preferences");
          },
        },
        {
          label: "Map Settings",
          click: () => {
            mainWindow.webContents.send("open-map-settings");
          },
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About OmniView",
          click: () => {
            mainWindow.webContents.send("show-about");
          },
        },
        {
          label: "Documentation",
          click: () => {
            require("electron").shell.openExternal(
              "https://github.com/Vinit710/OMNIVIEW"
            );
          },
        },
      ],
    },
  ];
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "../assets/icon.ico"),
  });

  // Start with splash screen
  mainWindow.loadFile(
    path.join(__dirname, "../renderer/screens/splash/splash.html")
  );

  // After splash screen completes, restore window frame
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  const e = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(e);

  // Add Referer header for OSM tile requests (required by usage policy)
  const { session } = require("electron");
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["https://*.tile.openstreetmap.org/*"] },
    (details, callback) => {
      details.requestHeaders["Referer"] = "https://omniview.app";
      callback({ requestHeaders: details.requestHeaders });
    }
  );
}
(app.whenReady().then(() => {
  (createWindow(),
    app.on("activate", () => {
      0 === BrowserWindow.getAllWindows().length && createWindow();
    }));
}),
  app.on("window-all-closed", () => {
    "darwin" !== process.platform && app.quit();
  }));
