using System.Windows.Forms;
using CompanionAgent.Tray;

Application.EnableVisualStyles();
Application.SetCompatibleTextRenderingDefault(false);
// Install WinForms sync context before TrayApplicationContext constructor runs,
// so SynchronizationContext.Current is not null when captured there.
SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
Application.Run(new TrayApplicationContext());
