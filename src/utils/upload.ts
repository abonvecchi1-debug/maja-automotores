export async function uploadVehicleImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('maja-auth-token');
  const res = await fetch('/api/upload/vehicle-image', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) throw new Error('Error al subir imagen');
  const data = await res.json();
  return data.url as string;
}
