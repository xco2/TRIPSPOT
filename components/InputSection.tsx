import React, { useState } from 'react';
import { SAMPLE_PROMPT } from '../constants';
import Button from './ui/Button';

interface InputSectionProps {
  onParse: (text: string) => void;
  isLoading: boolean;
  mapLoaded: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onParse, isLoading, mapLoaded }) => {
  const [text, setText] = useState('');

  const handleSample = () => {
    setText(SAMPLE_PROMPT);
  };

  return (
    <div className="bg-white border border-black p-4 shadow-hard mb-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-bold text-lg">聊天记录</h2>
        <button 
          onClick={handleSample}
          className="text-xs underline text-gray-500 hover:text-black"
        >
          加载示例
        </button>
      </div>
      <textarea
        className="w-full h-32 border border-black p-3 text-sm focus:outline-none focus:bg-gray-50 resize-none"
        placeholder="粘贴微信聊天记录到这里... (例如：'一定要去南桥看蓝眼泪，然后去吃陶德砂锅')"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex justify-end">
        <Button 
          onClick={() => onParse(text)} 
          disabled={!text.trim() || isLoading || !mapLoaded}
        >
          {!mapLoaded ? '等待地图加载...' : isLoading ? '智能提取中...' : '提取地点'}
        </Button>
      </div>
    </div>
  );
};

export default InputSection;