'use client';

import React from 'react';
import { motion } from 'motion/react';

export const FerdowsiAvatar: React.FC<{ size?: number; audioVolume?: number }> = ({ size = 120, audioVolume = 0 }) => {
  const scaleFactor = 1 + (audioVolume / 255) * 0.2;
  const glowIntensity = 10 + (audioVolume / 255) * 30;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: scaleFactor, 
        opacity: 1,
        filter: `drop-shadow(0 0 ${glowIntensity}px rgba(212,175,55,0.4))`
      }}
      transition={{ duration: size > 150 ? 0.3 : 1.5, ease: "easeOut" }}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Dynamic Aura */}
      <motion.div 
        className="absolute inset-0 rounded-full bg-royal-gold/10 blur-2xl"
        animate={{ 
          scale: [1, 1.2 * scaleFactor, 1],
          opacity: [0.3, 0.6 + (audioVolume / 255) * 0.4, 0.3] 
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Main SVG Avatar */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <radialGradient id="avatarBgGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="100%" stopColor="#050505" />
          </radialGradient>
          
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="50%" stopColor="#9D00FF" />
            <stop offset="100%" stopColor="#00F0FF" />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          <filter id="glitch">
             <feTurbulence type="fractalNoise" baseFrequency="0.15 0.03" numOctaves="1" result="noise" />
             <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* Background Shamseh (Persian Star Pattern) */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          filter="url(#glitch)"
        >
          {[...Array(12)].map((_, i) => (
            <path
              key={i}
              d="M100 20 L110 50 L100 60 L90 50 Z"
              fill="url(#goldGradient)"
              opacity="0.3"
              transform={`rotate(${i * 30} 100 100)`}
            />
          ))}
          <circle cx="100" cy="100" r="80" stroke="url(#goldGradient)" strokeWidth="0.5" opacity="0.5" strokeDasharray="2 4" />
        </motion.g>

        {/* Outer Rings */}
        <circle cx="100" cy="100" r="92" stroke="url(#goldGradient)" strokeWidth="1" opacity="0.6" filter="url(#glitch)" />
        <circle cx="100" cy="100" r="88" stroke="#00ced1" strokeWidth="0.5" opacity="0.3" />

        {/* Stylized Turban (The Crown of Wisdom) */}
        <motion.path
          d="M55 85 C55 45 145 45 145 85 C145 105 55 105 55 85 Z"
          fill="#050505"
          stroke="url(#goldGradient)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
        <path
          d="M65 75 C65 60 135 60 135 75 C135 90 65 90 65 75 Z"
          fill="#008b8b"
          opacity="0.4"
        />
        
        {/* Face Silhouette & Beard */}
        <g filter="url(#glow)">
          {/* Face Outline */}
          <path
            d="M82 85 C82 85 82 135 100 145 C118 135 118 85 118 85"
            stroke="url(#goldGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          
          {/* Poetic Beard (Lattice Pattern) */}
          <path
            d="M88 115 C88 115 92 165 100 175 C108 165 112 115 112 115"
            fill="#050505"
            stroke="url(#goldGradient)"
            strokeWidth="1.5"
          />
          
          {/* Intricate Beard Details (Turquoise Accents) */}
          <motion.path 
            d="M94 130 L100 140 L106 130" 
            stroke="#00ced1" 
            strokeWidth="1" 
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.path 
            d="M96 145 L100 153 L104 145" 
            stroke="#00ced1" 
            strokeWidth="1" 
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />
        </g>
        
        {/* Eyes of the Sage (Pulsing Turquoise) */}
        <motion.circle 
          cx="92" cy="100" r="1.5" 
          fill="#00ced1"
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.circle 
          cx="108" cy="100" r="1.5" 
          fill="#00ced1"
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />

        {/* Poetic Resonance Lines */}
        <motion.path
          d="M40 100 Q70 90 100 100 T160 100"
          stroke="#00ced1"
          strokeWidth="0.5"
          opacity="0.1"
          animate={{ 
            d: ["M40 100 Q70 90 100 100 T160 100", "M40 100 Q70 110 100 100 T160 100", "M40 100 Q70 90 100 100 T160 100"]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      
      {/* Floating Wisdom Particles (Golden Dust) */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-0.5 bg-royal-gold rounded-full"
          animate={{
            y: [0, -40, -60],
            x: [0, (i % 2 === 0 ? 20 : -20), (i % 2 === 0 ? 40 : -40)],
            opacity: [0, 0.8, 0],
            scale: [0, 1.5, 0]
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.4,
            ease: "easeOut"
          }}
          style={{
            top: '60%',
            left: '50%',
          }}
        />
      ))}
    </motion.div>
  );
};
