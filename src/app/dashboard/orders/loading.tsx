export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-gray-500">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      <p>جاري تحميل الطلبات...</p>
    </div>
  );
}
