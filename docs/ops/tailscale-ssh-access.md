# Tailscale SSH Access

Production access uses the Tailscale address:

```bash
ssh -i "<local-key>" -o BatchMode=yes -p 22022 ubuntu@100.64.5.29
```

Do not copy private keys into the repository, documentation, logs, tickets, or chat output. Use local key files and OS-level SSH permissions.

Project path after login:

```bash
cd /home/ubuntu/agrios-server
```

If SSH or sudo requires an interactive password in a non-interactive run, stop and report the blocked operation instead of changing sudoers.
