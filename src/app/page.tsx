import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white gap-6">
      <h1 className="text-4xl font-bold">CompSync Timer</h1>
      <p className="text-gray-400">Synchronized multi-display competition timer</p>
      <div className="flex gap-4">
        <Link
          href="/admin"
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors"
        >
          Admin
        </Link>
        <Link
          href="/display"
          className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold transition-colors"
        >
          Display
        </Link>
      </div>
    </div>
  );
}
