import React from "react";
import { Languages } from "lucide-react";

const TranslationPanel = () => {
  const [translations, setTranslations] = React.useState<string[]>([]);

  return (
    <div className="bg-gray-800/90 rounded-lg p-4 shadow-lg">
      <div className="flex items-center space-x-2 mb-4">
        <Languages className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">
          Real-Time Translation
        </h3>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {translations.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Translations will appear here...
          </p>
        ) : (
          translations.map((text, index) => (
            <div key={index} className="bg-gray-700/50 p-2 rounded">
              <p className="text-white">{text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TranslationPanel;
