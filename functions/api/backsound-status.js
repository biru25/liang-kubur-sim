export async function onRequestGet() {
  return Response.json({
    ok: true,
    url: '/audio/backsound.mp3',
    file: 'backsound.mp3',
  });
}