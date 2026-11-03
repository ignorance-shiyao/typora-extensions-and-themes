#!/usr/bin/env ruby
# Run from a checkout of typora/theme.typora.io (gh-pages), with its bundle:
# bundle exec ruby /path/to/scripts/build-v1.rb /path/to/dist/themes https://themes.typora.io
require "logger" # ActiveSupport 6.1 in the upstream bundle needs Logger loaded.
require "jekyll"
require "fileutils"
require "tmpdir"
require_relative "legacy-themes"

destination, origin = ARGV
abort "Usage: build-v1.rb THEMES_DIST ORIGIN" unless destination && origin
destination = File.expand_path(destination)
origin = origin.delete_suffix("/")
uri = URI.parse(origin)
abort "ORIGIN must be an HTTP(S) origin" unless %w[http https].include?(uri.scheme) && uri.host && [nil, "", "/"].include?(uri.path) && !uri.query && !uri.fragment
abort "Build the V2 gallery first" unless File.file?(File.join(destination, "index.html"))

Dir.mktmpdir("typora-v1-") do |staging|
  config = Jekyll.configuration(
    "source" => Dir.pwd,
    "destination" => staging,
    "url" => origin,
    "baseurl" => LegacyThemes::PREFIX,
    "disable_disk_cache" => true,
  )
  Jekyll::Site.new(config).process
  abort "V1 gallery is missing" unless File.file?(File.join(staging, "index.html"))

  Dir.glob(File.join(staging, "**", "*.{html,css}")).each do |path|
    content = File.read(path, encoding: "UTF-8")
    File.write(path, path.end_with?(".html") ? LegacyThemes.html(content) : LegacyThemes.css(content))
  end
  # Jekyll copies the upstream GitHub Pages CNAME; it isn't part of this site.
  FileUtils.rm_f(File.join(staging, "CNAME"))
  gallery = Nokogiri::HTML(File.read(File.join(staging, "index.html")))
  links = gallery.css(".gallery .item a.item-inner")
  abort "V1 gallery has no themes" if links.empty?
  links.each do |link|
    path = URI::DEFAULT_PARSER.unescape(link["href"].split(/[?#]/, 2).first.delete_prefix("/v1/"))
    abort "Missing V1 theme page: #{path}" unless File.file?(File.join(staging, path, "index.html"))
  end
  files = Dir.glob(File.join(staging, "**", "*")).select { |path| File.file?(path) }
  oversized = files.find { |path| File.size(path) > 25 * 1024 * 1024 }
  abort "V1 asset exceeds the 25 MiB Workers limit: #{oversized}" if oversized
  abort "Combined gallery exceeds 20,000 static assets" if files.size + Dir.glob(File.join(destination, "**", "*")).count { |p| File.file?(p) } > 20_000

  target = File.join(destination, "v1")
  FileUtils.rm_rf(target)
  FileUtils.cp_r(staging, target)
  puts "#{links.size} V1 themes, #{files.size} files → #{target} (#{origin}/v1/)"
end
