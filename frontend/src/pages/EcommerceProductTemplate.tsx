import { useState } from "react";
import ProductTypeTemplate from "./ProductTypeTemplate";
import ProductDetailsTemplate from "./ProductDetailsTemplate";

const tabs = [
  { label: "Product Type Template", component: ProductTypeTemplate },
  { label: "Product Details Template", component: ProductDetailsTemplate },
];

export default function EcommerceProductTemplate() {
  const [activeIndex, setActiveIndex] = useState(0);
  const ActiveComponent = tabs[activeIndex].component;

  return (
    <div className="min-h-screen bg-gray-100 w-full">

      {/* Top Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-[#2C3E50]">Ecommerce Product Templates</h1>
      </div>

      {/* Tab Bar - vertical on mobile, horizontal on md+ */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex flex-col md:flex-row md:gap-0 md:overflow-x-auto">
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              onClick={() => setActiveIndex(index)}
              className={`w-full md:w-auto text-left md:text-center px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 whitespace-nowrap ${
                activeIndex === index
                  ? "border-[#E87028] text-[#E87028]"
                  : "border-transparent text-gray-500 hover:text-[#E87028] hover:border-orange-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        <ActiveComponent />
      </div>
    </div>
  );
}
