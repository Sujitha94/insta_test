import { useState } from "react";
import { MessageCircle, Save } from "lucide-react";

export default function IcebreakersTemplate() {
  const [questions, setQuestions] = useState({
    question1: "",
    question2: "",
    question3: "",
    question4: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setQuestions((prev) => ({ ...prev, [name]: value }));
  };

  const handleSend = async () => {
    try {
      console.log("Saving questions:", questions);
      await new Promise(resolve => setTimeout(resolve, 500));
      alert("Questions saved successfully!");
      setQuestions({ question1: "", question2: "", question3: "", question4: "" });
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save questions. Please try again.");
    }
  };

  return (
    <div className="bg-[#F8F9FB] min-h-screen w-full flex items-center justify-center px-3 py-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="bg-white shadow-sm border border-slate-200 px-4 py-3 rounded-xl mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Icebreaker Configuration</h1>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">Set up icebreaker questions for new conversations</p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white shadow-sm border border-slate-200 px-4 py-4 rounded-xl space-y-3">

          {/* Section header */}
          <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <MessageCircle className="w-3.5 h-3.5 text-orange-600" />
            <h2 className="text-xs font-semibold text-slate-700">Icebreakers Questions</h2>
          </div>

          {/* Questions */}
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="space-y-1">
                <label className="flex items-center text-[11px] font-semibold text-slate-500">
                  <span className="mr-1 text-slate-400">{num}.</span>
                  Question {num}
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <textarea
                  name={`question${num}`}
                  value={questions[`question${num}` as keyof typeof questions]}
                  onChange={handleChange}
                  placeholder={`Enter icebreaker question #${num}...`}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 transition-colors leading-relaxed"
                />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Save button */}
          <button
            onClick={handleSend}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-200 flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Save size={13} />
            Save Icebreakers Questions
          </button>

        </div>
      </div>
    </div>
  );
}
