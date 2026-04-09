import { Link } from "react-router-dom";

export default function ProductTemplate() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-16 sm:-mt-16">
      {/* Back Button - Top Left (Fixed on mobile, absolute on desktop) */}
      <Link
        to="/templates"
        className="fixed sm:absolute top-24 left-4 sm:top-20 sm:left-[17rem] px-4 py-2 sm:px-6 sm:py-2 bg-white text-black border-2 border-orange-300 rounded-lg font-semibold hover:bg-orange-100 hover:border-orange-400 transition-colors duration-200 z-10"
      >
        ← <span className="hidden sm:inline">Back to Templates</span>
        <span className="sm:hidden">Back</span>
      </Link>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white shadow-lg px-4 sm:px-6 py-5 rounded-xl">
          <h1 className="text-xl sm:text-2xl font-bold text-black text-center">
            Which category best matches your business type?
          </h1>
        </div>
        <div className="mt-4 p-4 sm:p-6 space-y-3 sm:space-y-4 bg-white rounded-xl shadow-lg">
          
          <Link
            to="/ecommerce-product-template"
            className="block w-full px-4 py-3 sm:px-6 sm:py-4 border-2 text-center border-orange-300 text-black text-base sm:text-lg font-semibold hover:bg-orange-100 hover:border-orange-400 transition-colors duration-200"
          >
            E-commerce Business
          </Link>
        </div>
      </div>
    </div>
  );
}

