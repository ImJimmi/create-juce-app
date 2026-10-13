default:
    @just --list

release part="patch":
    npm version {{part}} --message "v%s"
    git push --follow-tags
