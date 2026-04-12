export async function askAI({ message, userData, token }) {
  const response = await fetch('http://localhost:5001/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      userData,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'AI request failed');
  }

  return data;
}