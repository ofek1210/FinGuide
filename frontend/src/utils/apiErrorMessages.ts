/**
 * מחזיר הודעת שגיאה ידידותית למשתמש לפי קוד סטטוס או ההודעה מהשרת.
 */
export function getApiErrorMessage(message: string, status?: number): string {
  if (status === 401) {
    return "פג תוקף ההתחברות. נא להתחבר מחדש.";
  }
  if (status === 429) {
    return "יותר מדי בקשות. נסה שוב מאוחר יותר.";
  }
  if (status !== undefined && status >= 500) {
    return "שגיאה בשרת. נסה שוב מאוחר יותר.";
  }
  return message;
}
