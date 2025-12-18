import { Loader2 } from 'lucide-react';

export default function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full min-h-[60vh]">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      </div>
      <p className="mt-4 text-gray-500 font-medium animate-pulse text-lg">Loading...</p>
    </div>
  );
}
