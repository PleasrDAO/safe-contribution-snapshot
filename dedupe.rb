require "json"

lines = File.open("partybid-contributions.ts").readlines

contributions = {}
contributions.default = 0

lines.each do |line|

  m = line.match(/'(.+)': '(.+)'/)
  contributions[m[1]] = contributions[m[1]] + m[2].to_f
end

puts contributions.to_json