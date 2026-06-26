const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showBrowserNotification(title: string, body: string, url?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body,
    icon: `${window.location.origin}${basePath}/logo-icon.png`,
    badge: `${window.location.origin}${basePath}/logo-icon.png`,
    tag: "repolit",
  });
  if (url) {
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }
}
