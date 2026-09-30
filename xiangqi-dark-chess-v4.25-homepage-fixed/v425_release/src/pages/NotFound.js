import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from "../components/ui/button.js";
import { Card, CardContent } from "../components/ui/card.js";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";
export default function NotFound() {
    const [, setLocation] = useLocation();
    const handleGoHome = () => {
        setLocation("/");
    };
    return (_jsx("div", { className: "min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100", children: _jsx(Card, { className: "w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm", children: _jsxs(CardContent, { className: "pt-8 pb-8 text-center", children: [_jsx("div", { className: "flex justify-center mb-6", children: _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 bg-red-100 rounded-full animate-pulse" }), _jsx(AlertCircle, { className: "relative h-16 w-16 text-red-500" })] }) }), _jsx("h1", { className: "text-4xl font-bold text-slate-900 mb-2", children: "404" }), _jsx("h2", { className: "text-xl font-semibold text-slate-700 mb-4", children: "Page Not Found" }), _jsxs("p", { className: "text-slate-600 mb-8 leading-relaxed", children: ["Sorry, the page you are looking for doesn't exist.", _jsx("br", {}), "It may have been moved or deleted."] }), _jsx("div", { className: "flex flex-col sm:flex-row gap-3 justify-center", children: _jsxs(Button, { onClick: handleGoHome, className: "bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg", children: [_jsx(Home, { className: "w-4 h-4 mr-2" }), "Go Home"] }) })] }) }) }));
}
