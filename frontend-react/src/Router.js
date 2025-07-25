// src/Router.js
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Login from './pages/login'; // pages 폴더를 src 아래로 옮겼다고 가정
import Register from './pages/register';
import ChatRooms from './pages/chat-rooms';
import NewChatRoom from './pages/chat-rooms/new';
import ChatPage from './pages/chat';
import Profile from './pages/profile';
import Navbar from './components/Navbar';

// withAuth, withoutAuth HOC를 가져옵니다.
import { withAuth } from './middleware/withAuth';
import { withoutAuth } from './middleware/withAuth';

// 각 페이지 컴포넌트에 HOC를 적용합니다.
const AuthChatRooms = withAuth(ChatRooms);
const AuthNewChatRoom = withAuth(NewChatRoom);
const AuthChatPage = withAuth(ChatPage);
const AuthProfile = withAuth(Profile);

const WithoutAuthLogin = withoutAuth(Login);
const WithoutAuthRegister = withoutAuth(Register);

function RouterContent() {
  const location = useLocation();
  const showNavbar = !['/', '/register'].includes(location.pathname);

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<WithoutAuthLogin />} />
        <Route path="/login" element={<WithoutAuthLogin />} />
        <Route path="/register" element={<WithoutAuthRegister />} />
        <Route path="/chat-rooms" element={<AuthChatRooms />} />
        <Route path="/chat-rooms/new" element={<AuthNewChatRoom />} />
        <Route path="/chat" element={<AuthChatPage />} />
        <Route path="/profile" element={<AuthProfile />} />
      </Routes>
    </>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <RouterContent />
    </BrowserRouter>
  );
}

export default AppRouter;