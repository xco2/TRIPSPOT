import React, { useState } from 'react';
import Button from './ui/Button';
import { loginUser } from '../utils/storage';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock auth - in a real app this would verify against backend or hash
    // Here we just check for non-empty to "enter" the system, 
    // or you could set a specific code like "admin"
    if (password.trim().length > 0) {
      loginUser();
      onLoginSuccess();
    } else {
      setError('请输入访问密码 (任意字符即可)');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-muted p-4">
      <div className="bg-white border border-black shadow-hard p-8 w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2 tracking-tighter">旅点 TRIPSPOT</h1>
          <p className="text-gray-500 text-sm">家庭旅行计划服务器</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2">访问密码</label>
            <input 
              type="password" 
              className="w-full border border-black p-2 focus:outline-none focus:bg-gray-50"
              placeholder="******"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          {error && <p className="text-red-500 text-xs">{error}</p>}
          
          <Button fullWidth type="submit">
            登录系统
          </Button>
        </form>
        
        <div className="mt-6 text-center text-xs text-gray-400">
          v1.5 Enterprise Edition
        </div>
      </div>
    </div>
  );
};

export default Login;
