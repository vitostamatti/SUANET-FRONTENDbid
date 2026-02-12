'use client'

export default function LayoutTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Layout Test - Modal Actualizado</h1>
        <p className="text-gray-600 mb-4">El modal ha sido actualizado con:</p>
        <ul className="text-left text-gray-700 mb-4">
          <li>• Panel izquierdo: 500px (antes 480px)</li>
          <li>• Reproductor de video: 480px × 360px (antes 460px × 345px)</li>
          <li>• Mejor alineación y aprovechamiento del espacio</li>
          <li>• Controles Play/Stop centrados</li>
        </ul>
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✅ Layout optimizado y verificado
        </div>
      </div>
    </div>
  );
}