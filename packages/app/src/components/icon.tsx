import React from 'react'

interface IconProps {
  name: keyof typeof customIcons
  onClick?: () => void
}

const customIcons = {
  test: [
    <path d="M480-80 120-280v-400l360-200 360 200v400L480-80ZM364-590q23-24 53-37t63-13q33 0 63 13t53 37l120-67-236-131-236 131 120 67Zm76 396v-131q-54-14-87-57t-33-98q0-11 1-20.5t4-19.5l-125-70v263l240 133Zm40-206q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm40 206 240-133v-263l-125 70q3 10 4 19.5t1 20.5q0 55-33 98t-87 57v131Z" />,
  ],
  'caret-down': [<path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />],
  'caret-right': [<path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" />],
  plus: [<path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />],
}

export const Icon: React.FC<IconProps> = (props) => {
  const [icon, viewBox] = customIcons[props.name]
  return (
    <svg
      onClick={props.onClick}
      viewBox={(viewBox as any) ?? '0 -960 960 960'}
      height="1em"
      fill="currentColor"
    >
      {icon}
    </svg>
  )
}
